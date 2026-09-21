import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { publishAnalysisStatus } from '../services/analysisEvents.service.js';
import { claimNextJob } from '../services/workerQueue.service.js';
import { requireAuth } from '../middleware/auth.js';
import { enforceRolePolicy } from '../middleware/authorize.js';
import {
  requireOwnDocument,
  requireOwnAssociation,
  requireViewableDocument,
} from '../middleware/ownership.js';
import { upload, structureUpload } from '../middleware/upload.js';
import { semanticSearch } from '../controllers/search.controller.js';
import { listTopics, createTopic, deleteTopic } from '../controllers/topics.controller.js';
import {
  listDrafts,
  createDraft,
  getDraft,
  updateDraft,
  deleteDraft,
  getDraftHistory,
  restoreDraftVersion,
} from '../controllers/reportDrafts.controller.js';
import { login, me } from '../controllers/auth.controller.js';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  serveFile,
  streamDocumentStatus,
  updateDocumentAnalysisStatus,
  updateDocumentDate,
  trashDocument,
  listTrash,
  restoreDocument,
  destroyDocument,
} from '../controllers/documents.controller.js';
import {
  classifyDocument,
  validateAssociation,
  rejectAssociation,
  reassignAssociation,
} from '../controllers/classification.controller.js';
import { getCompliance } from '../controllers/compliance.controller.js';
import {
  getCriterion,
  getReportStructure,
  uploadReportStructure,
  parseStructureDocument,
  getStructureHistory,
  restoreStructureVersion,
} from '../controllers/criteria.controller.js';
import * as cloud from '../controllers/cloud.controller.js';

const router = Router();

// Health
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Auth
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, me);

// Google OAuth callback es público (Google redirige sin token; usa "state").
router.get('/cloud/google/callback', cloud.callback);

// Dropbox callback público
router.get('/cloud/dropbox/callback', cloud.dropboxCallback);

// Valida cualquier :id de la API antes de que llegue a un controlador.
//
// Sin esto, "/documents/undefined" produce Number("undefined") = NaN, Prisma
// lanza, y como Express 4 no atrapa los rechazos de un handler async el proceso
// entero se cae: una URL mal formada bastaba para tumbar el backend.
router.param('id', (req, res, next, value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: `Id invalido: "${value}".` });
    }

    return next();
});

// Cola de trabajos para el worker de analisis (HU11).
//
// Va antes de requireAuth a proposito: el worker no es un usuario con sesion,
// se autentica con el token compartido igual que el webhook. Preguntar es su
// unica forma de recibir trabajo, porque corre en una maquina domestica sin IP
// estable ni puertos abiertos.
router.get('/worker/jobs', async (req, res) => {
    // Comparar contra una variable sin definir dejaba el endpoint ABIERTO:
    // undefined !== undefined es false, asi que una peticion sin cabecera
    // pasaba el control. Si no hay token configurado, no se atiende a nadie.
    if (!process.env.WORKER_API_TOKEN) {
        console.error('WORKER_API_TOKEN no configurado: la cola queda cerrada.');
        return res.status(503).json({ error: 'Cola no configurada.' });
    }

    if (req.headers['x-worker-token'] !== process.env.WORKER_API_TOKEN) {
        console.warn('Intento de acceso no autorizado a la cola del worker');
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        const job = await claimNextJob();

        // 204 para que el worker distinga "no hay trabajo" de un error y siga
        // preguntando en silencio.
        if (!job) return res.status(204).end();

        return res.json(job);
    } catch (error) {
        console.error('Error entregando trabajo al worker:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Webhook de actualización de estado de análisis (HU12)
router.post('/webhooks/worker-update', async (req, res) => {
    const workerToken = req.headers['x-worker-token'];

    // Mismo riesgo que en /worker/jobs: sin secreto configurado, una peticion
    // sin cabecera pasaba el control y podia escribir estados y asociaciones.
    if (!process.env.WORKER_WEBHOOK_SECRET) {
        console.error('WORKER_WEBHOOK_SECRET no configurado: webhook cerrado.');
        return res.status(503).json({ error: 'Webhook no configurado.' });
    }

    if (workerToken !== process.env.WORKER_WEBHOOK_SECRET) {
        console.warn('Intento de acceso no autorizado al webhook');
        return res.status(401).json({ error: 'No autorizado' });
    }
    const { documentId, status, result, userId, error } = req.body;

    await prisma.document.update({
        where: { id: documentId },
        data: {
            analysisStatus: status,
            analysisError: status === 'ERROR' ? error : null,
            analysisStatusUpdatedAt: new Date(),
            // La justificacion se guarda siempre, tambien cuando el documento
            // resulta NO relevante. Antes se descartaba, y un documento
            // descartado por la IA quedaba indistinguible de uno nunca
            // analizado: misma pantalla vacia, ninguna explicacion.
            ...(status === 'COMPLETED' && result
                ? {
                      analysisSummary: result.justification ?? null,
                      analysisEngine: result.engine ?? null,
                  }
                : {}),
        }
    });

    if (status === 'COMPLETED' && result && result.relevant) {
        await prisma.$transaction(async (tx) => {
            const pending = await tx.association.findMany({
                where: { documentId, status: 'PROPOSED' },
            });

            if (pending.length) {
                await tx.association.updateMany({
                    where: { id: { in: pending.map((item) => item.id) } },
                    data: { status: 'NOT_VALIDATED', validatedById: null, validatedAt: null },
                });
                await tx.associationHistory.createMany({
                    data: pending.map((item) => ({
                        associationId: item.id,
                        action: 'REJECTED',
                        userId,
                        snapshot: { reemplazadaPorNuevaPropuestaIA: true },
                    })),
                });
            }

            const created = await tx.association.create({
                data: {
                    documentId,
                    subcriterionId: result.subcriterionId,
                    status: 'PROPOSED',
                    justification: result.justification,
                    evidenceFragment: result.evidenceFragment,
                    confidence: result.confidence,
                }
            });

            await tx.associationHistory.create({
                data: {
                    associationId: created.id,
                    action: 'PROPOSED',
                    userId,
                    snapshot: {
                        subcriterion: result.subcriterion.code,
                        confidence: result.confidence,
                        matchedKeywords: result.matchedKeywords,
                    },
                },
            });
        });
    }

    publishAnalysisStatus({
        documentId,
        analysisStatus: status,
        analysisError: error,
        analysisStatusUpdatedAt: new Date(),
    });

    res.status(200).send('OK');
});

// A partir de aquí, todo requiere autenticación y un rol con permiso sobre la
// ruta (EP 1.1 · EP 1.2). La política es de denegación por defecto y se resuelve
// antes de consultar la base de datos.
router.use(requireAuth);
router.use(enforceRolePolicy);

// Búsqueda semántica
router.post('/search/semantic', semanticSearch);

// Temáticas
router.get('/topics', listTopics);
router.post('/topics', createTopic);
router.delete('/topics/:id', deleteTopic);

// Documentos (HU07)
router.post('/documents', upload.single('file'), uploadDocument);
router.get('/documents', listDocuments);
router.get('/documents/trash', listTrash);
router.get('/documents/:id/stream', requireViewableDocument, streamDocumentStatus);
router.get('/documents/:id', requireViewableDocument, getDocument);
router.get('/documents/:id/file', requireViewableDocument, serveFile);
router.patch('/documents/:id/analysis-status', requireOwnDocument, updateDocumentAnalysisStatus);
router.patch('/documents/:id/date', requireOwnDocument, updateDocumentDate);
router.post('/documents/:id/trash', requireOwnDocument, trashDocument);
router.post('/documents/:id/restore', requireOwnDocument, restoreDocument);
router.delete('/documents/:id', requireOwnDocument, destroyDocument);

// Clasificación (HU01)
router.post('/documents/:id/classify', requireOwnDocument, classifyDocument);
router.post('/associations/:id/validate', requireOwnAssociation, validateAssociation);
router.post('/associations/:id/reject', requireOwnAssociation, rejectAssociation);
router.put('/documents/:id/association', requireOwnDocument, reassignAssociation);

// Cumplimiento (HU02)
router.get('/compliance', getCompliance);

// Criterio y estructura del informe (HU03)
router.get('/criteria', getCriterion);
router.get('/report-structure', getReportStructure);
router.get('/report-structure/history', getStructureHistory);
router.post('/report-structure', uploadReportStructure);
router.post('/report-structure/parse', structureUpload.single('file'), parseStructureDocument);
router.post('/report-structure/:version/restore', restoreStructureVersion);

// Redacción del informe — borradores
router.get('/report-drafts', listDrafts);
router.post('/report-drafts', createDraft);
router.get('/report-drafts/:id', getDraft);
router.put('/report-drafts/:id', updateDraft);
router.delete('/report-drafts/:id', deleteDraft);
router.get('/report-drafts/:id/history', getDraftHistory);
router.post('/report-drafts/:id/versions/:version/restore', restoreDraftVersion);

// Google Drive (HU09)
router.get('/cloud/google/status', cloud.status);
router.get('/cloud/google/auth-url', cloud.authUrl);
router.get('/cloud/google/files', cloud.listFiles);
router.post('/cloud/google/import', cloud.importFile);

// Dropbox (HU10)
// Dropbox (HU09)
router.get('/cloud/dropbox/status',   cloud.dropboxStatus);
router.get('/cloud/dropbox/auth-url', cloud.dropboxAuthUrl);
router.get('/cloud/dropbox/files',    cloud.dropboxListFiles);
router.post('/cloud/dropbox/import',  cloud.dropboxImportFile);

router.delete('/cloud/:provider/disconnect', cloud.disconnect);

export default router;
