// Saneamiento del HTML del borrador del informe.
//
// El editor del frontend es un `contentEditable`: el navegador (y un pegado
// desde Word) puede introducir marcado arbitrario. Como el contenido vuelve a
// inyectarse como HTML al reabrir el borrador, se normaliza en el servidor a
// una lista blanca mínima —la que cubren los formatos de la HU: título,
// negrita, cursiva y lista— y se descartan todos los atributos, con lo que
// desaparecen `on*=`, `style` y `href="javascript:"` sin depender de un parser.

/** Etiquetas conservadas; el resto se elimina manteniendo su texto interior. */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'div',
  'h1', 'h2', 'h3',
  'b', 'strong', 'i', 'em', 'u',
  'ul', 'ol', 'li',
  'blockquote',
]);

/** Etiquetas cuyo contenido se descarta por completo, no solo la etiqueta. */
const DROP_WITH_CONTENT = ['script', 'style', 'iframe', 'object', 'embed', 'noscript'];

/** Límite defensivo del tamaño de un borrador (coincide con el body de Express). */
export const MAX_DRAFT_HTML_BYTES = 1_000_000;

/**
 * Devuelve el HTML reducido a la lista blanca, sin atributos ni comentarios.
 * @param {unknown} input
 * @returns {string}
 */
export function sanitizeDraftHtml(input) {
  if (typeof input !== 'string' || input.length === 0) return '';

  let html = input.replace(/<!--[\s\S]*?-->/g, '');

  for (const tag of DROP_WITH_CONTENT) {
    html = html
      .replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '')
      .replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
  }

  html = html.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_match, slash, name) => {
    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (tag === 'br') return '<br>';
    return slash ? `</${tag}>` : `<${tag}>`;
  });

  // Un `<` suelto que no formaba parte de una etiqueta se escapa para que no
  // pueda reabrir un elemento al reinyectar el contenido.
  html = html.replace(/<(?![a-zA-Z/])/g, '&lt;');

  return html.trim();
}

/**
 * Texto plano derivado del borrador: insumo de la revisión de incoherencias y
 * de la vista previa del listado.
 * @param {unknown} html
 * @returns {string}
 */
export function htmlToPlainText(html) {
  if (typeof html !== 'string' || html.length === 0) return '';

  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|ul|ol|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normaliza el título: una sola línea, sin marcado y acotado.
 * @param {unknown} input
 * @param {string} fallback
 * @returns {string}
 */
export function normalizeDraftTitle(input, fallback = 'Borrador sin título') {
  if (typeof input !== 'string') return fallback;
  const clean = htmlToPlainText(input).replace(/\s+/g, ' ').trim().slice(0, 200);
  return clean.length > 0 ? clean : fallback;
}
