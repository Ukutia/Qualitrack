import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/vector.service.js', () => ({ searchSimilarChunks: vi.fn() }));
vi.mock('../src/services/llm.service.js', () => ({
  generateText: vi.fn(),
  llmLabel: () => 'test',
}));

const { searchSimilarChunks } = await import('../src/services/vector.service.js');
const { generateText } = await import('../src/services/gemini.service.js');
const { generateReportPreview, clearReportPreviewCache, limitWords } =
  await import('../src/services/reportPreview.service.js');

const section = { id: 12, name: 'Resumen Ejecutivo', description: 'Síntesis general del informe.' };
const sentence = 'La institución presenta avances relevantes en su gestión académica.';
const longText = Array.from({ length: 40 }, () => sentence).join(' '); // ~240 palabras

describe('limitWords', () => {
  it('no altera un texto que ya cumple el límite y conserva los párrafos', () => {
    const text = 'Primer párrafo.\n\nSegundo párrafo.';
    expect(limitWords(text, 150)).toMatchObject({ text, truncated: false, wordCount: 4 });
  });

  it('recorta a 150 palabras como máximo y termina en fin de oración', () => {
    const result = limitWords(longText, 150);
    expect(result.truncated).toBe(true);
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.text.endsWith('.')).toBe(true);
  });

  it('agrega puntos suspensivos si no hay un fin de oración cercano', () => {
    const result = limitWords(Array(200).fill('palabra').join(' '), 150);
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.text.endsWith('…')).toBe(true);
  });
});

describe('generateReportPreview — límite y reglas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearReportPreviewCache();
    searchSimilarChunks.mockImplementation(async (_q, { documentId }) => [
      { documentId, originalName: `doc-${documentId}.pdf`, content: 'Contenido relevante.' },
    ]);
  });

  it('respeta 150 palabras aunque la IA se exceda', async () => {
    generateText.mockResolvedValue(longText);
    const result = await generateReportPreview({ section, requirements: {}, documentIds: [1] });
    expect(result.wordCount).toBeLessThanOrEqual(150);
    expect(result.truncated).toBe(true);
  });

  it('ignora maxPages/dimensions/rawInstructions de la CNA en el prompt', async () => {
    generateText.mockResolvedValue('Texto breve.');
    await generateReportPreview({
      section,
      requirements: { maxPages: 5, rawInstructions: 'TEXTO CRUDO DEL PDF', dimensions: [{ code: 'I' }], instructions: [] },
      documentIds: [1],
    });
    const { prompt } = generateText.mock.calls[0][0];
    expect(prompt).not.toContain('TEXTO CRUDO DEL PDF');
    expect(prompt).toContain('150 palabras');
  });
});