import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({ prisma: {
  topic: { findMany: vi.fn() }, documentChunk: { count: vi.fn() },
  association: { findMany: vi.fn() }, $queryRaw: vi.fn(),
  document: { findFirst: vi.fn() },
} }));
vi.mock('../src/services/embedding.service.js', () => ({ generateEmbedding: vi.fn().mockResolvedValue([1, 0]), EMBEDDING_MODEL: 'test-model' }));
vi.mock('../src/services/encryption.service.js', () => ({ decryptText: (text) => text }));
const { buildNetwork, getNetwork } = await import('../src/services/network.service.js');
const { documentContent } = await import('../src/controllers/network.controller.js');
const { prisma } = await import('../src/config/prisma.js');
const { canAccess } = await import('../src/config/roles.js');
const topics = [{ id: 1, name: 'Calidad' }, { id: 2, name: 'Transparencia' }, { id: 3, name: 'Vacío' }];
const match = (topicId, documentId, similarity) => ({ topicId, documentId, similarity, originalName: `Documento ${documentId}` });
const assoc = (id, documentId, code, status = 'VALIDATED') => ({ id, documentId, status, subcriterion: { code, name: code } });
beforeEach(() => vi.clearAllMocks());

describe('red de evidencias', () => {
  it('incluye el 60% exacto y excluye valores inferiores o inválidos', () => {
    const graph = buildNetwork(topics, [match(1, 1, .6), match(1, 2, .5999999), match(1, 3, NaN)], []);
    expect(graph.documents.map((d) => d.id)).toEqual([1]);
    expect(graph.topics.map((t) => t.connections)).toEqual([1, 0, 0]);
  });
  it('deduplica fragmentos y conserva conexiones de un documento con distintas temáticas', () => {
    const graph = buildNetwork(topics, [match(1, 1, .7), match(1, 1, .8), match(2, 1, .65), match(2, 2, .59)], []);
    expect(graph.documents).toHaveLength(1);
    expect(graph.connections).toHaveLength(2);
    expect(graph.connections[0].similarity).toBe(.8);
  });
  it('cuenta documentos por subcriterio, excluye rechazos y resuelve empates explícitamente', () => {
    const graph = buildNetwork(topics, [match(1, 1, .8), match(1, 2, .8)], [
      assoc(1, 1, '9.1.1'), assoc(2, 1, '9.1.1'), assoc(3, 2, '9.1.1'),
      assoc(4, 2, '9.1.1', 'NOT_VALIDATED'), assoc(5, 2, '9.1.2', 'PROPOSED'), assoc(6, 9, '9.1.3'),
    ]);
    expect(graph.topics[0].dominantSubcriteria.map((s) => [s.code, s.count])).toEqual([['9.1.1', 1], ['9.1.2', 1]]);
    expect(graph.topics[2].dominantSubcriteria).toEqual([]);
  });
  it('no limita el mapa a los primeros 50 documentos', () => {
    expect(buildNetwork(topics, Array.from({ length: 75 }, (_, i) => match(1, i + 1, .8)), []).connections).toHaveLength(75);
  });
  it('mantiene temáticas sin evidencia y no consulta embeddings si no hay documentos', async () => {
    prisma.topic.findMany.mockResolvedValue(topics);
    prisma.documentChunk.count.mockResolvedValue(0);
    expect((await getNetwork(7)).topics).toHaveLength(3);
    expect(prisma.topic.findMany).toHaveBeenCalledWith({ where: { createdById: 7 }, orderBy: { id: 'asc' } });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it('consulta solo documentos activos, listos y del modelo vigente sin LIMIT', async () => {
    prisma.topic.findMany.mockResolvedValue([topics[0]]);
    prisma.documentChunk.count.mockResolvedValue(1);
    prisma.$queryRaw.mockResolvedValue([match(1, 1, .8)]);
    prisma.association.findMany.mockResolvedValue([]);
    expect((await getNetwork(7)).connections).toHaveLength(1);
    const sql = prisma.$queryRaw.mock.calls[0][0].join('?');
    expect(sql).toContain('d."deletedAt" IS NULL');
    expect(sql).toContain('d."vectorizationStatus" = \'READY\'');
    expect(sql).toContain('dc."embeddingModel" =');
    expect(sql).not.toContain('LIMIT');
  });
  it('permite lectura solo al administrador', () => {
    for (const path of ['/topics/network', '/documents/1/content']) {
      expect(canAccess('user', 'GET', path)).toBe(false);
      expect(canAccess('admin', 'GET', path)).toBe(true);
      expect(canAccess('ingestor', 'GET', path)).toBe(false);
    }
  });
  it('devuelve contenido completo, sin el recorte de la vista previa', async () => {
    const content = 'Evidencia '.repeat(400);
    prisma.document.findFirst.mockResolvedValue({ id: 1, originalName: 'Informe', extractedText: content });
    const res = { json: vi.fn() };
    await documentContent({ params: { id: '1' } }, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ id: 1, name: 'Informe', content });
    expect(prisma.document.findFirst.mock.calls[0][0].where).toEqual({ id: 1, deletedAt: null });
  });
});
