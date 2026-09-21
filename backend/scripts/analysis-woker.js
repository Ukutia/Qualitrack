import { PrismaClient } from '@prisma/client';
import http from 'http';

const prisma = new PrismaClient();

const ORDER = [
  'RECEIVED',
  'PREPARING_ANALYSIS',
  'SENT_TO_ANALYZER',
  'RECEIVED_BY_ANALYZER',
  'EXTRACTING_CONTENT',
  'ANALYZING_CONTENT',
  'RECEIVING_RESULT',
  'COMPLETED',
];

const workerPort = Number(process.env.ANALYSIS_WORKER_PORT || 4001);
const token = process.env.ANALYSIS_WORKER_TOKEN || 'local-analysis-token';
const pollMs = Number(process.env.ANALYSIS_WORKER_POLL_MS || 5000);
const batchSize = Number(process.env.ANALYSIS_WORKER_BATCH_SIZE || 25);

async function advanceOneStep() {
  const docs = await prisma.document.findMany({
    where: {
      OR: [
        { analysisStatus: 'RECEIVED' },
        { analysisStatus: 'PREPARING_ANALYSIS' },
        { analysisStatus: 'SENT_TO_ANALYZER' },
        { analysisStatus: 'RECEIVED_BY_ANALYZER' },
        { analysisStatus: 'EXTRACTING_CONTENT' },
        { analysisStatus: 'ANALYZING_CONTENT' },
        { analysisStatus: 'RECEIVING_RESULT' },
      ],
    },
    orderBy: { id: 'asc' },
    take: batchSize,
  });

  if (docs.length === 0) return;

  for (const doc of docs) {
    const current = doc.analysisStatus || 'RECEIVED';
    const idx = ORDER.indexOf(current);
    const next = ORDER[Math.min(idx + 1, ORDER.length - 1)];

    await prisma.document.update({
      where: { id: doc.id },
      data: { analysisStatus: next },
    });

    console.log(`[analysis-worker] document=${doc.id} ${current} -> ${next}`);
  }
}

function verifyToken(header) {
  return header === token;
}

function startHttpServer() {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, service: 'analysis-worker', port: workerPort }));
        return;
      }

      if (req.method === 'POST' && req.url === '/advance') {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const header = req.headers.authorization || '';
            if (!verifyToken(header.replace('Bearer ', ''))) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized' }));
              return;
            }

            await advanceOneStep();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, processed: true }));
          } catch (error) {
            console.error('[analysis-worker] http error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Worker failed' }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (error) {
      console.error('[analysis-worker] http server error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  server.listen(workerPort, () => {
    console.log(`[analysis-worker] HTTP listening on ${workerPort}`);
  });
}

async function main() {
  try {
    startHttpServer();
    await advanceOneStep();
    setInterval(() => {
      advanceOneStep().catch((error) => {
        console.error('[analysis-worker] polling error:', error);
      });
    }, pollMs);
  } catch (error) {
    console.error('[analysis-worker] error:', error);
  }
}

main();
