import { prisma } from '../config/prisma.js';
import { generateEmbedding, EMBEDDING_MODEL } from './embedding.service.js';

export const NETWORK_THRESHOLD = 0.6;

// One edge per topic/document, regardless of how many chunks match.
export function buildNetwork(topics, matches, associations) {
  const documents = new Map();
  const edges = new Map();
  for (const match of matches) {
    if (!Number.isFinite(match.similarity) || match.similarity < NETWORK_THRESHOLD) continue;
    const key = `${match.topicId}:${match.documentId}`;
    if (!edges.has(key) || edges.get(key).similarity < match.similarity) {
      edges.set(key, { topicId: match.topicId, documentId: match.documentId, similarity: match.similarity });
    }
    documents.set(match.documentId, { id: match.documentId, name: match.originalName });
  }
  // History can contain several records for the same subcriterion. Only its
  // latest state counts, and each document contributes at most once per code.
  const latest = new Map();
  for (const association of [...associations].sort((a, b) => b.id - a.id)) {
    const key = `${association.documentId}:${association.subcriterion.code}`;
    if (!latest.has(key)) latest.set(key, association);
  }
  const links = [...edges.values()];
  return {
    threshold: NETWORK_THRESHOLD,
    topics: topics.map(({ id, name }) => {
      const ids = new Set(links.filter((e) => e.topicId === id).map((e) => e.documentId));
      const counts = new Map();
      for (const a of latest.values()) {
        if (!ids.has(a.documentId) || a.status === 'NOT_VALIDATED') continue;
        const code = a.subcriterion.code;
        const entry = counts.get(code) || { ...a.subcriterion, count: 0 };
        entry.count++;
        counts.set(code, entry);
      }
      const ranked = [...counts.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
      return { id, name, connections: ids.size, dominantSubcriteria: ranked.filter((a) => a.count === ranked[0]?.count) };
    }),
    documents: [...documents.values()],
    connections: links,
  };
}

export async function getNetwork(userId) {
  const topics = await prisma.topic.findMany({ where: { createdById: userId }, orderBy: { id: 'asc' } });
  const matches = [];
  // Same repository visibility as document reading for admin and quality team.
  // No top-N cap: the map must include every qualifying document.
  if (topics.length && await prisma.documentChunk.count({ where: { document: { deletedAt: null, vectorizationStatus: 'READY' } } })) {
    for (const topic of topics) {
      const embedding = await generateEmbedding(topic.name, 'query');
      const vector = `[${embedding.join(',')}]`;
      const rows = await prisma.$queryRaw`
        SELECT d.id AS "documentId", d."originalName",
          MAX(1 - (dc.embedding <=> ${vector}::vector)) AS similarity
        FROM "DocumentChunk" dc JOIN "Document" d ON d.id = dc."documentId"
        WHERE d."deletedAt" IS NULL AND d."vectorizationStatus" = 'READY'
          AND dc.embedding IS NOT NULL AND dc."embeddingModel" = ${EMBEDDING_MODEL}
        GROUP BY d.id, d."originalName"
        HAVING MAX(1 - (dc.embedding <=> ${vector}::vector)) >= ${NETWORK_THRESHOLD}
        ORDER BY d.id
      `;
      matches.push(...rows.map((row) => ({ ...row, similarity: Number(row.similarity), topicId: topic.id })));
    }
  }
  const associations = matches.length ? await prisma.association.findMany({
    where: { documentId: { in: [...new Set(matches.map((m) => m.documentId))] } },
    select: { id: true, documentId: true, status: true, subcriterion: { select: { code: true, name: true } } },
  }) : [];
  return buildNetwork(topics, matches, associations);
}
