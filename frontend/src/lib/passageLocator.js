// Ubica el texto de un fragmento (chunk) dentro de un documento renderizado.
//
// El chunk se generó desde el texto extraído en el backend (pdf-parse, mammoth,
// sheet_to_csv), que separa palabras, líneas y celdas distinto que el visor.
// Por eso la comparación ignora los espacios (y en planillas, las comas y
// comillas del CSV), normaliza ligaduras y mayúsculas, y guarda para cada
// carácter comparable de qué segmento y posición original viene.

export const TEXT_IGNORED = /\s/;
export const CSV_IGNORED = /[\s,"]/;

function forEachComparable(text, ignored, visit) {
  for (let i = 0; i < text.length; i++) {
    const normalized = text[i].normalize('NFKC').toLowerCase();
    for (const ch of normalized) {
      if (!ignored.test(ch)) visit(ch, i);
    }
  }
}

export function compact(text, ignored = TEXT_IGNORED) {
  let out = '';
  forEachComparable(text || '', ignored, (ch) => { out += ch; });
  return out;
}

/**
 * Índice comparable de una lista de segmentos de texto (nodos, celdas, páginas).
 * `segment[k]` y `offset[k]` indican de dónde viene el carácter k de `text`.
 */
export function buildIndex(segments, ignored = TEXT_IGNORED) {
  const chars = [];
  const segment = [];
  const offset = [];
  segments.forEach((text, s) => {
    forEachComparable(text || '', ignored, (ch, i) => {
      chars.push(ch);
      segment.push(s);
      offset.push(i);
    });
  });
  return { text: chars.join(''), segment, offset };
}

/**
 * Busca el fragmento en el índice. Primero completo; si no aparece (el visor
 * no muestra exactamente el mismo texto que la extracción), se ancla en un
 * trozo del fragmento y se extiende mientras coincida.
 * Devuelve { start, end, exact } en posiciones del índice, o null.
 */
export function locate(index, passage, ignored = TEXT_IGNORED) {
  const needle = compact(passage, ignored);
  if (!needle || !index.text) return null;

  const exact = index.text.indexOf(needle);
  if (exact >= 0) return { start: exact, end: exact + needle.length, exact: true };

  for (const from of [0, 120, 400, 800, 1200]) {
    for (const size of [60, 30]) {
      const anchor = needle.slice(from, from + size);
      if (anchor.length < size) continue;
      const start = index.text.indexOf(anchor);
      if (start < 0) continue;
      let length = anchor.length;
      while (start + length < index.text.length && index.text[start + length] === needle[from + length]) length++;
      return { start, end: start + length, exact: false };
    }
  }
  return null;
}

/** Nodos de texto de `root` en orden de lectura, omitiendo los que `skip` descarta. */
export function textNodes(root, skip = () => false) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (skip(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

/**
 * Envuelve en <mark> el rango [start, end) de un índice construido sobre
 * `nodes`. Devuelve las marcas en orden de lectura.
 */
export function highlightNodes(nodes, index, start, end, className = 'passage-mark') {
  if (start >= end) return [];

  // Rango de caracteres originales a marcar dentro de cada nodo.
  const spans = new Map();
  for (let k = start; k < end; k++) {
    const node = index.segment[k];
    const at = index.offset[k];
    const span = spans.get(node);
    if (span) span.to = at + 1;
    else spans.set(node, { from: at, to: at + 1 });
  }

  const marks = [];
  // De atrás hacia adelante: dividir un nodo no altera a los anteriores.
  [...spans.entries()].reverse().forEach(([n, { from, to }]) => {
    let target = nodes[n];
    if (!target.parentNode) return;
    if (from > 0) target = target.splitText(from);
    if (to - from < target.length) target.splitText(to - from);
    const mark = document.createElement('mark');
    mark.className = className;
    target.parentNode.insertBefore(mark, target);
    mark.appendChild(target);
    marks.unshift(mark);
  });
  return marks;
}

export const CONTEXT_CLASS = 'passage-mark';
export const FOCUS_CLASS = 'passage-focus';

/**
 * Rangos a resaltar: el fragmento completo como contexto tenue y, dentro de
 * él, las oraciones relacionadas con la temática como foco. Sin foco (no hubo
 * temática o no se ubicó), el fragmento entero se marca como foco. Con
 * `focus` undefined (el foco todavía se está calculando) el fragmento queda
 * solo como contexto, para no destacar de más mientras tanto.
 * Devuelve { hit, focused, ranges: [[start, end, className]] } en orden, o null.
 */
export function planHighlights(index, passage, focus, ignored = TEXT_IGNORED) {
  const hit = passage ? locate(index, passage, ignored) : null;
  if (!hit) return null;
  if (focus === undefined) return { hit, focused: false, ranges: [[hit.start, hit.end, CONTEXT_CLASS]] };

  const focusRanges = [];
  for (const sentence of focus || []) {
    const needle = compact(sentence, ignored);
    if (!needle) continue;
    // Se busca desde un poco antes del inicio: con la ubicación aproximada el
    // fragmento puede haber quedado corrido algunos caracteres.
    const at = index.text.indexOf(needle, Math.max(0, hit.start - needle.length));
    if (at < 0 || at > hit.end) continue;
    focusRanges.push([at, at + needle.length]);
  }
  focusRanges.sort((a, b) => a[0] - b[0]);

  if (focusRanges.length === 0) return { hit, focused: false, ranges: [[hit.start, hit.end, FOCUS_CLASS]] };

  const ranges = [];
  let cursor = hit.start;
  for (const [a, b] of focusRanges) {
    if (a > cursor) ranges.push([cursor, a, CONTEXT_CLASS]);
    const from = Math.max(a, cursor);
    if (b > from) ranges.push([from, b, FOCUS_CLASS]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < hit.end) ranges.push([cursor, hit.end, CONTEXT_CLASS]);
  return { hit, focused: true, ranges };
}

/**
 * Aplica varios rangos sobre los mismos nodos. Van de atrás hacia adelante
 * para que dividir un nodo no desplace las posiciones que quedan por marcar.
 */
export function applyHighlights(nodes, index, ranges) {
  const marks = [];
  for (let i = ranges.length - 1; i >= 0; i--) {
    const [start, end, className] = ranges[i];
    marks.unshift(...highlightNodes(nodes, index, start, end, className));
  }
  return marks;
}
