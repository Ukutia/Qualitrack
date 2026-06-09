/**
 * Extrae secciones estructuradas desde texto de un documento oficial (PDF/DOCX).
 * Reconoce numeración decimal (1., 1.1., 2.3.1.) y detecta campos obligatorios.
 */

const OPTIONAL_KEYWORDS = ['opcional', 'optativo', 'si aplica', 'si corresponde', 'when applicable'];

/**
 * @param {string} text  Texto plano extraído del documento.
 * @returns {{ code: string, name: string, required: boolean, level: number }[]}
 */
export function parseStructureSections(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length >= 3);
  const sections = [];
  const seenCodes = new Set();

  for (const line of lines) {
    const parsed = parseSectionLine(line);
    if (!parsed) continue;
    const { code, name } = parsed;
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);

    const level = code.split('.').filter(Boolean).length;
    const required = !isOptional(line);
    sections.push({ code, name, required, level });
  }

  return sections;
}

/**
 * Intenta identificar una línea como encabezado de sección.
 * Formatos reconocidos:
 *   "1. Título"   "1.1 Subtítulo"   "2.3.1. Campo"   "1) Título"
 */
function parseSectionLine(line) {
  // Código numérico separado por puntos, seguido de separador y nombre
  const m = line.match(/^(\d+(?:\.\d+)*)[\s.)\-:]+(.+)$/);
  if (!m) return null;

  const code = m[1];
  const rawName = m[2].trim();

  // Descarta líneas que parecen párrafos (demasiado texto o sólo números)
  if (rawName.length < 2 || rawName.length > 200) return null;
  if (/^\d+$/.test(rawName)) return null;
  const wordCount = rawName.split(/\s+/).length;
  if (wordCount > 25) return null;

  // Quita puntuación de cierre del nombre
  const name = rawName.replace(/[.:;,]+$/, '').trim();
  if (name.length < 2) return null;

  return { code, name };
}

function isOptional(line) {
  const norm = line
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return OPTIONAL_KEYWORDS.some((kw) => norm.includes(kw));
}
