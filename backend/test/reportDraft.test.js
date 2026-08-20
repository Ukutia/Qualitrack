// Redacción del informe — saneamiento del borrador y reglas de guardado.
// El contenido vuelve a inyectarse como HTML en el editor, así que lo que
// interesa probar es qué sobrevive al saneamiento y qué se descarta.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    reportDraft: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const { prisma } = await import('../src/config/prisma.js');
const {
  sanitizeDraftHtml,
  htmlToPlainText,
  normalizeDraftTitle,
} = await import('../src/services/draftSanitizer.service.js');
const { updateDraft, createDraft } = await import('../src/controllers/reportDrafts.controller.js');

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.end = vi.fn(() => res);
  return res;
}

describe('sanitizeDraftHtml', () => {
  it('conserva los formatos exigidos por la HU', () => {
    const html = '<h2>Criterio 9</h2><p><b>negrita</b> e <i>cursiva</i></p><ul><li>uno</li></ul>';
    expect(sanitizeDraftHtml(html)).toBe(html);
  });

  it('elimina atributos, incluidos los manejadores de eventos', () => {
    const html = '<p onclick="robar()" style="color:red">texto</p>';
    expect(sanitizeDraftHtml(html)).toBe('<p>texto</p>');
  });

  it('descarta script y su contenido', () => {
    const html = '<p>antes</p><script>alert(1)</script><p>después</p>';
    expect(sanitizeDraftHtml(html)).toBe('<p>antes</p><p>después</p>');
  });

  it('desenvuelve etiquetas no permitidas sin perder el texto', () => {
    expect(sanitizeDraftHtml('<p>ver <a href="http://x">enlace</a></p>')).toBe(
      '<p>ver enlace</p>'
    );
  });

  it('normaliza los saltos de línea del editor', () => {
    expect(sanitizeDraftHtml('<p>a<br/>b</p>')).toBe('<p>a<br>b</p>');
  });

  it('devuelve cadena vacía cuando no hay contenido', () => {
    expect(sanitizeDraftHtml(undefined)).toBe('');
    expect(sanitizeDraftHtml('')).toBe('');
  });
});

describe('htmlToPlainText', () => {
  it('convierte bloques en saltos de línea y decodifica entidades', () => {
    expect(htmlToPlainText('<h2>Título</h2><p>a &amp; b</p>')).toBe('Título\na & b');
  });

  it('no decodifica dos veces las entidades escapadas', () => {
    expect(htmlToPlainText('<p>&amp;lt;p&amp;gt;</p>')).toBe('&lt;p&gt;');
  });
});

describe('normalizeDraftTitle', () => {
  it('usa el respaldo cuando el título queda vacío', () => {
    expect(normalizeDraftTitle('   ', 'Anterior')).toBe('Anterior');
    expect(normalizeDraftTitle(undefined)).toBe('Borrador sin título');
  });

  it('colapsa espacios y quita marcado', () => {
    expect(normalizeDraftTitle('<b>Informe   2026</b>')).toBe('Informe 2026');
  });
});

describe('updateDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  const req = (body, id = '1') => ({ params: { id }, body, user: { id: 7 } });

  it('guarda el HTML saneado y devuelve la hora de la versión almacenada', async () => {
    const updatedAt = new Date('2026-08-13T10:30:00Z');
    prisma.reportDraft.findFirst.mockResolvedValue({ id: 1, title: 'Informe' });
    prisma.reportDraft.update.mockResolvedValue({ id: 1, title: 'Informe', updatedAt });

    const res = mockRes();
    await updateDraft(req({ contentHtml: '<p onclick="x">hola</p>' }), res);

    expect(prisma.reportDraft.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { contentHtml: '<p>hola</p>', contentText: 'hola' },
    });
    expect(res.json).toHaveBeenCalledWith({ id: 1, title: 'Informe', updatedAt });
  });

  it('no permite editar un borrador de otro usuario', async () => {
    prisma.reportDraft.findFirst.mockResolvedValue(null);

    const res = mockRes();
    await updateDraft(req({ contentHtml: '<p>x</p>' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.reportDraft.update).not.toHaveBeenCalled();
  });

  it('rechaza un borrador que excede el tamaño máximo', async () => {
    prisma.reportDraft.findFirst.mockResolvedValue({ id: 1, title: 'Informe' });

    const res = mockRes();
    await updateDraft(req({ contentHtml: 'a'.repeat(1_000_001) }), res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(prisma.reportDraft.update).not.toHaveBeenCalled();
  });

  it('rechaza una petición sin cambios', async () => {
    prisma.reportDraft.findFirst.mockResolvedValue({ id: 1, title: 'Informe' });

    const res = mockRes();
    await updateDraft(req({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('createDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea un borrador vacío con título por defecto', async () => {
    prisma.reportDraft.create.mockResolvedValue({ id: 3 });

    const res = mockRes();
    await createDraft({ body: {}, user: { id: 7 } }, res);

    expect(prisma.reportDraft.create).toHaveBeenCalledWith({
      data: {
        title: 'Borrador sin título',
        contentHtml: '',
        contentText: '',
        authorId: 7,
      },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
