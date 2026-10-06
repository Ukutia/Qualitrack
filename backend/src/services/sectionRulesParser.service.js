/** Extrae instrucciones y límites desde los bloques de una estructura de informe. */

// "1. Resumen", "1) Resumen", "1.1 Algo". Un entero solo ("1 Solo en el caso…")
// NO es encabezado: en los PDF suele ser una nota al pie.
const SECTION_HEADER = /^(\d+(?:\.\d+)*)(\s*[.)\-:]\s*|\s+)(.+)$/;
const CRITERIA_START = /^criterios\s+a\s+examinar/i;
const EXTENSION_LINE = /^extensi[oó]n\s+m[aá]xima/i;
const FOOTNOTE_LIKE = /^\d{1,2}\s+[A-ZÁÉÍÓÚÑ]/; // "1 Solo en el caso…" (nota al pie)
const MAX_HEADER_WORDS = 25; // como el parser original: más palabras = párrafo, no título
const MAX_SPACE_ONLY_WORDS = 12; // "4 Conclusiones" sí; "1 Solo en el caso de…" no
const CRITERIA_MAX_LINES = 30; // tope de seguridad de la zona "Criterios a examinar"
const PAGE_NUMBER = /^\d{1,3}$/; // número de página suelto
const DIMENSION_HEADING = /\b[IVX]+\.\s+Dimensi[oó]n/;

const DESCRIPTION_LABEL = /Descripci[oó]n\s+del\s+[ií]tem/i;
const MAX_PAGES = /Extensi[oó]n\s+m[aá]xima\s*:?\s*(\d+)\s*p[aá]ginas?/i;
// "I. Dimensión X  Descripción del ítem  <criterios>  Extensión máxima N páginas"
const DIMENSION_BLOCK =
  /\b([IVX]+)\.\s+(Dimensi[oó]n.+?)\s+Descripci[oó]n\s+del\s+[ií]tem\s+(.*?)\s*Extensi[oó]n\s+m[aá]xima\s*:?\s*(\d+)\s*p[aá]ginas?/gi;

function normalizeLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseHeader(line) {
  if (/^\d+\s+p[aá]ginas?$/i.test(line)) return null;
  const match = line.match(SECTION_HEADER);
  if (!match) return null;
  const [, code, separator, rawName] = match;

  const name = rawName.replace(/[.:;,]+$/, '').trim();
  if (name.length < 2 || name.length > 200 || /^\d+$/.test(name)) return null;

  const words = name.split(/\s+/).length;
  if (words > MAX_HEADER_WORDS) return null;

  // "1 Solo en el caso…" (sin punto ni paréntesis) suele ser texto corrido o nota al pie.
  const spaceOnly = !code.includes('.') && !/[.)\-:]/.test(separator);
  if (spaceOnly && words > MAX_SPACE_ONLY_WORDS) return null;

  return { code, name };
}

/**
 * Códigos de subsección ("1.1", "2.3.1"): se aceptan si no se han visto (como el parser original).
 * Códigos de primer nivel: deben avanzar de forma plausible (1, 2, 3…), lo que descarta
 * repeticiones (notas 1–5), años ("2020 fue…") y cifras ("750 palabras…").
 */
function isAcceptedCode(code, lastTop, seen) {
  if (seen.has(code)) return false;
  if (code.includes('.')) return true;
  const top = Number(code);
  return lastTop === 0 ? top <= 20 : top > lastTop && top <= lastTop + 5;
}

/**
 * Divide el texto en bloques por sección. Además de la numeración, ignora:
 *  - números de página sueltos,
 *  - la zona entre "Criterios a examinar" y "Extensión máxima" (criterios 1–14 del PDF de la CNA),
 *  - notas al pie ("1 Solo en el caso de…") para que no contaminen las descripciones.
 */
function blockSections(lines) {
  const blocks = [];
  const seen = new Set();
  let current = null;
  let lastTop = 0;
  let criteriaLines = 0;

  for (const line of lines) {
    if (PAGE_NUMBER.test(line)) continue;

    if (CRITERIA_START.test(line)) criteriaLines = CRITERIA_MAX_LINES;
    else if (EXTENSION_LINE.test(line)) criteriaLines = 0;
    const inCriteria = criteriaLines > 0;
    if (inCriteria) criteriaLines -= 1;

    const header = inCriteria ? null : parseHeader(line);
    if (header && isAcceptedCode(header.code, lastTop, seen)) {
      seen.add(header.code);
      if (!header.code.includes('.')) lastTop = Number(header.code);
      if (current) blocks.push(current);
      current = { ...header, lines: [] };
      continue;
    }

    if (FOOTNOTE_LIKE.test(line) && line.length > 40) continue;
    if (current) current.lines.push(line);
  }

  if (current) blocks.push(current);
  return blocks;
}

function toInstructions(description) {
  if (!description) return [];
  const sentences = description
    .split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
  return [...new Set(sentences)];
}

function buildRules(block) {
  // Se une todo: el PDF parte "Descripción del / ítem" y las frases en varias líneas.
  const text = block.lines.join(' ').replace(/\s+/g, ' ').trim();

  const dimensions = [...text.matchAll(DIMENSION_BLOCK)].map((m) => ({
    code: m[1],
    name: m[2].replace(/(?<=\p{L})\d+$/u, '').trim(), // quita marca de nota al pie ("Medio3")
    criteria: m[3].trim(),
    maxPages: Number(m[4]),
  }));

  let description;
  let maxPages = null;

  if (dimensions.length > 0) {
    // Sección con varias tablas (p. ej. "Análisis crítico"): el texto previo es la descripción.
    const cut = text.search(DIMENSION_HEADING);
    description = text.slice(0, cut).trim() || null;
  } else {
    const desc = text.match(/Descripci[oó]n\s+del\s+[ií]tem\s+(.*?)(?:\s*Extensi[oó]n\s+m[aá]xima|$)/i);
    description = desc ? desc[1].trim() || null : DESCRIPTION_LABEL.test(text) ? null : text || null;
    const max = text.match(MAX_PAGES);
    maxPages = max ? Number(max[1]) : null;
  }

  return {
    code: block.code,
    name: block.name,
    description,
    requirements: {
      maxPages,
      dimensions,
      instructions: toInstructions(description),
      rawInstructions: text,
    },
  };
}

/** Devuelve reglas por sección de primer nivel (un elemento por código, sin duplicados). */
export function parseSectionRules(text) {
  return blockSections(normalizeLines(text)).map(buildRules);
}

/**
 * Bloques de sección de primer nivel ({ code, name, lines }) con las mismas guardas
 * que las reglas. Es la única interpretación del PDF: el parser de estructura la reutiliza.
 */
export function parseSectionBlocks(text) {
  return blockSections(normalizeLines(text));
}

/**
 * Solo la descripción de cada sección, para usarla en el prompt.
 * No calcula reglas (páginas, dimensiones, instrucciones): esas no se usan.
 * @returns {{ code: string, name: string, description: string | null }[]}
 */
export function parseSectionDescriptions(text) {
  return parseSectionBlocks(text).map((block) => {
    const { code, name, description } = buildRules(block);
    return { code, name, description };
  });
}