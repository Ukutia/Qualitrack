import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.hoisted(() => vi.fn());
const decryptText = vi.hoisted(() => vi.fn((value) => value));

vi.mock('../src/config/prisma.js', () => ({
  prisma: { document: { findFirst } },
}));
vi.mock('../src/services/encryption.service.js', () => ({ decryptText }));

const { rankChunksLexically, searchRelevantChunksLexically } =
  await import('../src/services/lexicalRetrieval.service.js');

describe('recuperación léxica para informes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prioriza el fragmento que cubre los conceptos de la sección', () => {
    const chunks = [
      'La biblioteca renovó sus salas y amplió el horario de atención.',
      'La retención estudiantil aumentó durante 2025 y mejoró la titulación oportuna.',
      'El comité revisó el presupuesto anual de infraestructura.',
    ];

    const ranked = rankChunksLexically('Retención y titulación estudiantil', chunks);

    expect(ranked[0]).toMatchObject({ chunkIndex: 1, content: chunks[1] });
    expect(ranked[0].lexicalScore).toBeGreaterThan(ranked[1].lexicalScore);
  });

  it('lee el texto extraído, lo descifra y devuelve fragmentos con la forma esperada', async () => {
    const extractedText = [
      'La biblioteca renovó sus colecciones. '.repeat(70),
      'La tasa de retención estudiantil mejoró de forma sostenida durante 2025. '.repeat(70),
    ].join(' ');
    findFirst.mockResolvedValue({ id: 8, originalName: 'resultados.pdf', extractedText: 'cifrado' });
    decryptText.mockReturnValue(extractedText);

    const results = await searchRelevantChunksLexically('retención estudiantil', {
      documentId: 8,
      limit: 1,
    });

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 8, deletedAt: null },
    }));
    expect(decryptText).toHaveBeenCalledWith('cifrado');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ documentId: 8, originalName: 'resultados.pdf' });
    expect(results[0].content).toContain('retención estudiantil');
  });
});
