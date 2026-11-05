import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchSimilarChunks = vi.hoisted(() => vi.fn());
const searchRelevantChunksLexically = vi.hoisted(() => vi.fn());
const generateText = vi.hoisted(() => vi.fn());

vi.mock('../src/config/env.js', () => ({
  config: { embeddings: { enabled: false } },
}));
vi.mock('../src/services/vector.service.js', () => ({ searchSimilarChunks }));
vi.mock('../src/services/lexicalRetrieval.service.js', () => ({ searchRelevantChunksLexically }));
vi.mock('../src/services/llm.service.js', () => ({
  generateText,
  llmLabel: () => 'test',
}));

const { clearReportPreviewCache, generateReportPreview } =
  await import('../src/services/reportPreview.service.js');

describe('generateReportPreview sin embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearReportPreviewCache();
    searchRelevantChunksLexically.mockImplementation(async (_query, { documentId }) => [{
      documentId,
      originalName: `evidencia-${documentId}.pdf`,
      content: 'La retención estudiantil aumentó durante 2025 como resultado del acompañamiento académico implementado por la carrera. '.repeat(5),
    }]);
    generateText.mockResolvedValue('La retención estudiantil aumentó durante 2025.');
  });

  it('usa recuperación léxica y no invoca la búsqueda vectorial', async () => {
    const result = await generateReportPreview({
      section: { id: 4, name: 'Retención estudiantil', description: 'Resultados y acciones de mejora.' },
      requirements: {},
      documentIds: [10, 11],
    });

    expect(searchRelevantChunksLexically).toHaveBeenCalledTimes(2);
    expect(searchSimilarChunks).not.toHaveBeenCalled();
    expect(generateText).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ retrievalMode: 'lexical' });
    expect(result.sources).toHaveLength(2);
  });
});
