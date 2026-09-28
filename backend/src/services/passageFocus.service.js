// Dentro de un chunk (~2000 caracteres), identifica las oraciones que más se
// relacionan con la temática buscada. El chunk entero es la unidad de búsqueda,
// pero resaltarlo completo no le muestra al usuario por qué coincidió.
import { generateEmbedding } from './embedding.service.js';

const MAX_PIECES = 60;
const MAX_PIECE_LENGTH = 400;
// Cada trozo cuesta un embedding (~0,3 s en CPU): las oraciones cortas se
// agrupan para que un chunk de 2000 caracteres quede en unos 10 trozos.
const MIN_PIECE_LENGTH = 120;
const MAX_FOCUS = 3;
// Solo se destacan las oraciones casi tan cercanas como la mejor: una segunda
// oración claramente peor no ayuda a entender la coincidencia.
const FOCUS_MARGIN = 0.04;
const CONCURRENCY = 4;
const CACHE_SIZE = 300;

// Volver a abrir el mismo pasaje (o volver atrás y entrar de nuevo) no debe
// recalcular los embeddings. El id del chunk cambia si se re-vectoriza.
const cache = new Map();

function remember(key, value) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
  return value;
}

function splitLong(piece) {
  if (piece.length <= MAX_PIECE_LENGTH) return [piece];
  const words = piece.split(' ');
  const out = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + word.length + 1 > MAX_PIECE_LENGTH) {
      out.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out;
}

/** Celdas de un trozo de CSV, respetando las comillas ("a, b" es una celda). */
function csvCells(text) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

/**
 * Parte el texto en oraciones (o celdas, para planillas). Los trozos muy
 * cortos se unen al siguiente para que el embedding tenga contexto.
 */
export function splitPieces(text, format) {
  const raw = format === 'xlsx'
    ? csvCells(text)
    : text.split(/(?<=[.!?;:])\s+|\s+(?=[•▪●■-]\s)/);

  const pieces = [];
  let pending = '';
  for (const part of raw) {
    const piece = `${pending} ${part}`.trim();
    if (piece.length < MIN_PIECE_LENGTH && format !== 'xlsx') {
      pending = piece;
      continue;
    }
    pending = '';
    if (piece.replace(/[^\p{L}\p{N}]/gu, '').length >= 3) pieces.push(...splitLong(piece));
  }
  if (pending.replace(/[^\p{L}\p{N}]/gu, '').length >= 3) pieces.push(pending);

  return [...new Set(pieces)].slice(0, MAX_PIECES);
}

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

async function mapLimited(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Devuelve las oraciones del chunk más cercanas a la temática, en el orden en
 * que aparecen, o null si no se pudo calcular (sin servicio de embeddings).
 */
export async function findFocus(query, text, format, cacheKey = null) {
  const key = cacheKey && `${cacheKey}:${query.toLowerCase()}`;
  if (key && cache.has(key)) return remember(key, cache.get(key));

  const pieces = splitPieces(text, format);
  if (!query || pieces.length === 0) return null;

  try {
    const queryEmbedding = await generateEmbedding(query, 'query');
    const embeddings = await mapLimited(pieces, CONCURRENCY, (piece) => generateEmbedding(piece, 'passage'));
    // Los embeddings vienen normalizados: el producto punto es la similitud coseno.
    const scored = pieces.map((piece, i) => ({ text: piece, similarity: dot(queryEmbedding, embeddings[i]), order: i }));
    const best = Math.max(...scored.map((s) => s.similarity));

    const focus = scored
      .filter((s) => s.similarity >= best - FOCUS_MARGIN)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MAX_FOCUS)
      .sort((a, b) => a.order - b.order)
      .map(({ text: piece, similarity }) => ({ text: piece, similarity }));
    return key ? remember(key, focus) : focus;
  } catch (error) {
    console.error('No se pudo calcular el foco del pasaje:', error.message);
    return null;
  }
}
