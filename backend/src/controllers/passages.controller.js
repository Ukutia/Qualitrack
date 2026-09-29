// Visualización de pasajes: abre el documento original en el fragmento que
// entregó la búsqueda temática. Los chunks no guardan página ni celda, así que
// aquí solo se entrega el texto del fragmento; el frontend lo ubica dentro del
// documento renderizado.
import * as XLSX from 'xlsx';
import { prisma } from '../config/prisma.js';
import { readFile, fileExists } from '../services/storage.service.js';
import { decryptText } from '../services/encryption.service.js';
import { findFocus } from '../services/passageFocus.service.js';

export const DOCUMENT_UNAVAILABLE = {
  error: 'Documento no disponible',
  code: 'DOCUMENT_UNAVAILABLE',
};

// Tope de celdas enviadas al navegador. El visor solo dibuja una ventana de
// filas, así que el límite protege la memoria del servidor y el tamaño de la
// respuesta, no el DOM.
const MAX_SHEET_CELLS = 1_000_000;

/**
 * Devuelve el documento si sigue disponible para visualizarse: no está en la
 * papelera ni fue eliminado, y su archivo original sigue en el almacenamiento.
 */
async function findAvailableDocument(id) {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.deletedAt) return null;
  if (!(await fileExists(doc.storagePath))) return null;
  return doc;
}

export async function getPassage(req, res, next) {
  try {
    const id = Number(req.params.id);
    const chunkIndex = Number(req.params.chunkIndex);
    if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({ error: 'Fragmento inválido.' });
    }

    const doc = await findAvailableDocument(id);
    if (!doc) return res.status(410).json(DOCUMENT_UNAVAILABLE);

    const chunk = await prisma.documentChunk.findUnique({
      where: { documentId_chunkIndex: { documentId: id, chunkIndex } },
      select: { chunkIndex: true, content: true },
    });

    return res.json({
      document: { id: doc.id, originalName: doc.originalName, format: doc.format },
      // Si el documento se re-vectorizó, el índice puede ya no existir: el
      // documento igual se muestra, solo que sin fragmento que resaltar.
      passage: chunk ? { chunkIndex: chunk.chunkIndex, content: decryptText(chunk.content) } : null,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Oraciones del fragmento más relacionadas con la temática (?q=). Va aparte
 * del pasaje porque cuesta un embedding por oración (segundos en CPU): así el
 * documento se abre de inmediato y el foco se destaca cuando llega.
 */
export async function getPassageFocus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const chunkIndex = Number(req.params.chunkIndex);
    const query = typeof req.query?.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
    if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0) {
      return res.status(400).json({ error: 'Fragmento inválido.' });
    }
    if (!query) return res.status(400).json({ error: 'q es obligatorio.' });

    const doc = await findAvailableDocument(id);
    if (!doc) return res.status(410).json(DOCUMENT_UNAVAILABLE);

    const chunk = await prisma.documentChunk.findUnique({
      where: { documentId_chunkIndex: { documentId: id, chunkIndex } },
      select: { id: true, content: true },
    });
    if (!chunk) return res.json({ focus: null });

    const focus = await findFocus(query, decryptText(chunk.content), doc.format, `${chunk.id}`);
    return res.json({ focus });
  } catch (error) {
    return next(error);
  }
}

/**
 * Contenido de un XLSX como grilla de textos formateados, el mismo texto que
 * usa la extracción (sheet_to_csv), para que el fragmento se pueda ubicar.
 */
export async function getSheets(req, res, next) {
  try {
    const doc = await findAvailableDocument(Number(req.params.id));
    if (!doc) return res.status(410).json(DOCUMENT_UNAVAILABLE);
    if (doc.format !== 'xlsx') return res.status(400).json({ error: 'El documento no es una planilla.' });

    const workbook = XLSX.read(await readFile(doc.storagePath), { type: 'buffer' });
    let budget = MAX_SHEET_CELLS;
    let truncated = false;

    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
      let rows = [];

      if (range) {
        const width = range.e.c - range.s.c + 1;
        const maxRows = Math.floor(Math.max(budget, 0) / width);
        if (range.e.r - range.s.r + 1 > maxRows) {
          // Se recorta el rango antes de leer: un !ref inflado por formato
          // (A1:XFD1048576) no debe materializarse entero en memoria.
          range.e.r = range.s.r + maxRows - 1;
          truncated = true;
        }
        // blankrows mantiene alineadas las filas con su número real en Excel.
        rows = maxRows > 0
          ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', blankrows: true, range })
          : [];
        budget -= rows.length * width;
      }

      return {
        name,
        firstRow: range ? range.s.r : 0,
        firstCol: range ? range.s.c : 0,
        rows: rows.map((row) => row.map((cell) => (cell == null ? '' : String(cell)))),
      };
    });

    return res.json({ sheets, truncated });
  } catch (error) {
    return next(error);
  }
}
