// Visualización de pasajes desde la búsqueda temática.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';

vi.mock('../src/config/prisma.js', () => ({ prisma: {
  document: { findUnique: vi.fn() },
  documentChunk: { findUnique: vi.fn() },
} }));
vi.mock('../src/services/storage.service.js', () => ({ readFile: vi.fn(), fileExists: vi.fn() }));
vi.mock('../src/services/encryption.service.js', () => ({ decryptText: (text) => `claro:${text}` }));
// Embedding de juguete: [menciona retención, menciona otra cosa], normalizado.
vi.mock('../src/services/embedding.service.js', () => ({
  generateEmbedding: vi.fn(async (text) => (/retenci/i.test(text) ? [1, 0] : [0, 1])),
}));

const { getPassage, getPassageFocus, getSheets } = await import('../src/controllers/passages.controller.js');
const { prisma } = await import('../src/config/prisma.js');
const { splitPieces, findFocus } = await import('../src/services/passageFocus.service.js');
const { generateEmbedding } = await import('../src/services/embedding.service.js');
const { readFile, fileExists } = await import('../src/services/storage.service.js');

function response() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}
const doc = (extra = {}) => ({ id: 4, originalName: 'Informe.pdf', format: 'pdf', storagePath: '/x', deletedAt: null, ...extra });
const run = async (handler, params, query = {}) => { const res = response(); await handler({ params, query }, res, (e) => { throw e; }); return res; };

beforeEach(() => {
  vi.clearAllMocks();
  fileExists.mockResolvedValue(true);
});

describe('pasajes de documentos', () => {
  it('entrega el documento y el texto descifrado del fragmento', async () => {
    prisma.document.findUnique.mockResolvedValue(doc());
    prisma.documentChunk.findUnique.mockResolvedValue({ chunkIndex: 2, content: 'cifrado' });
    const res = await run(getPassage, { id: '4', chunkIndex: '2' });
    expect(prisma.documentChunk.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { documentId_chunkIndex: { documentId: 4, chunkIndex: 2 } },
    }));
    expect(res.json).toHaveBeenCalledWith({
      document: { id: 4, originalName: 'Informe.pdf', format: 'pdf' },
      passage: { chunkIndex: 2, content: 'claro:cifrado' },
    });
  });

  it.each([
    ['en la papelera', doc({ deletedAt: new Date() }), true],
    ['eliminado definitivamente', null, true],
    ['sin archivo en el almacenamiento', doc(), false],
  ])('rechaza con "Documento no disponible" un documento %s', async (_, found, exists) => {
    prisma.document.findUnique.mockResolvedValue(found);
    fileExists.mockResolvedValue(exists);
    const res = await run(getPassage, { id: '4', chunkIndex: '0' });
    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({ error: 'Documento no disponible', code: 'DOCUMENT_UNAVAILABLE' });
    expect(prisma.documentChunk.findUnique).not.toHaveBeenCalled();
  });

  it('muestra el documento aunque el fragmento ya no exista', async () => {
    prisma.document.findUnique.mockResolvedValue(doc());
    prisma.documentChunk.findUnique.mockResolvedValue(null);
    const res = await run(getPassage, { id: '4', chunkIndex: '9' });
    expect(res.json.mock.calls[0][0].passage).toBeNull();
  });

  it('entrega aparte las oraciones relacionadas con la temática', async () => {
    prisma.document.findUnique.mockResolvedValue(doc());
    prisma.documentChunk.findUnique.mockResolvedValue({ id: 50, content: 'x' });
    const res = await run(getPassageFocus, { id: '4', chunkIndex: '0' }, { q: 'Retención estudiantil' });
    expect(res.json).toHaveBeenCalledWith({ focus: expect.any(Array) });
  });

  it('el foco exige temática y un documento disponible', async () => {
    expect((await run(getPassageFocus, { id: '4', chunkIndex: '0' }, {})).status).toHaveBeenCalledWith(400);
    prisma.document.findUnique.mockResolvedValue(doc({ deletedAt: new Date() }));
    expect((await run(getPassageFocus, { id: '4', chunkIndex: '0' }, { q: 'x' })).status).toHaveBeenCalledWith(410);
  });

  it('valida el índice del fragmento', async () => {
    const res = await run(getPassage, { id: '4', chunkIndex: '-1' });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('grilla de planillas', () => {
  it('devuelve cada hoja con su origen real y filas vacías alineadas', async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([['Indicador', 'Valor'], [], ['Retención', 0.87]], { origin: 'B3' });
    sheet['!ref'] = 'B3:C5';
    XLSX.utils.book_append_sheet(wb, sheet, 'Datos');
    prisma.document.findUnique.mockResolvedValue(doc({ format: 'xlsx' }));
    readFile.mockResolvedValue(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const res = await run(getSheets, { id: '4' });
    const { sheets, truncated } = res.json.mock.calls[0][0];
    expect(truncated).toBe(false);
    expect(sheets[0]).toMatchObject({ name: 'Datos', firstRow: 2, firstCol: 1 });
    expect(sheets[0].rows).toEqual([['Indicador', 'Valor'], ['', ''], ['Retención', '0.87']]);
  });

  it('rechaza una planilla que ya no está disponible', async () => {
    prisma.document.findUnique.mockResolvedValue(doc({ format: 'xlsx', deletedAt: new Date() }));
    const res = await run(getSheets, { id: '4' });
    expect(res.status).toHaveBeenCalledWith(410);
  });
});

describe('foco del pasaje', () => {
  const infra = 'La universidad amplió su infraestructura deportiva este año, con nuevas canchas, gimnasios y camarines para toda la comunidad estudiantil.';
  const retention = 'La tasa de retención de primer año subió a 87% en la cohorte 2023, gracias al programa de acompañamiento académico y tutorías entre pares.';
  const labs = 'Además se renovaron los laboratorios de química y física, incorporando equipamiento moderno para la docencia de pregrado y la investigación.';
  const text = `${infra} ${retention} ${labs}`;

  it('parte en oraciones y une los trozos demasiado cortos', () => {
    expect(splitPieces(text, 'pdf')).toEqual([infra, retention, labs]);
    expect(splitPieces('Sí. No. Tal vez.', 'pdf')).toEqual(['Sí. No. Tal vez.']);
  });

  it('en planillas usa las celdas y descarta las vacías', () => {
    expect(splitPieces(',,,Retención,,0.87,,', 'xlsx')).toEqual(['Retención', '0.87']);
    expect(splitPieces('Banco,"Carta de crédito confirmada, irrevocable",,"Dice ""sí"""', 'xlsx'))
      .toEqual(['Banco', 'Carta de crédito confirmada, irrevocable', 'Dice "sí"']);
  });

  it('elige la oración cercana a la temática, no todo el fragmento', async () => {
    const focus = await findFocus('retención', text, 'pdf');
    expect(focus.map((f) => f.text)).toEqual([retention]);
  });

  it('reutiliza el resultado al volver a abrir el mismo pasaje', async () => {
    await findFocus('Calidad', text, 'pdf', 'chunk-7');
    const calls = generateEmbedding.mock.calls.length;
    await findFocus('calidad', text, 'pdf', 'chunk-7');
    expect(generateEmbedding.mock.calls.length).toBe(calls);
  });

  it('si el servicio de embeddings falla, no rompe el visor', async () => {
    generateEmbedding.mockRejectedValueOnce(new Error('caído'));
    expect(await findFocus('retención', text, 'pdf')).toBeNull();
  });
});
