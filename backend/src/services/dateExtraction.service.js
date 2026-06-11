/**
 * Extrae la fecha de emisión/creación de un documento a partir de su texto.
 * Busca patrones comunes en documentos institucionales chilenos.
 * Devuelve un objeto Date si la detecta, o null si no puede determinarla.
 */

const MESES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Intenta parsear una fecha a partir de sus partes textuales.
 * @param {string|number} day
 * @param {string} monthStr  nombre del mes en español o inglés
 * @param {string|number} year
 * @returns {Date|null}
 */
function parseNamedDate(day, monthStr, year) {
  const m = MESES[monthStr.toLowerCase().trim()];
  if (m === undefined) return null;
  const d = parseInt(day, 10);
  const y = parseInt(year, 10);
  if (!d || !y || y < 1990 || y > 2100) return null;
  return new Date(y, m, d);
}

/**
 * Intenta parsear una fecha numérica DD/MM/YYYY o DD-MM-YYYY.
 */
function parseNumericDate(str) {
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = parseInt(dd, 10);
  const mo = parseInt(mm, 10) - 1;
  const y = parseInt(yyyy, 10);
  if (mo < 0 || mo > 11 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return new Date(y, mo, d);
}

/**
 * Extrae la fecha más relevante del texto del documento.
 * Estrategia: primero busca etiquetas explícitas (Fecha de emisión, Fecha:, etc.),
 * luego busca años solos en el nombre del archivo,
 * finalmente descarta si no encuentra nada confiable.
 *
 * @param {string} text       Texto extraído del documento
 * @param {string} fileName   Nombre original del archivo (como fallback)
 * @returns {Date|null}
 */
export function extractDocumentDate(text, fileName = '') {
  if (!text) return extractFromFileName(fileName);

  // ── 1. Etiquetas explícitas de fecha ─────────────────────────────────────
  // "Fecha de emisión: 15 de mayo de 2021"
  // "Fecha: 03/04/2022"
  // "Santiago, 12 de marzo de 2020"
  const labeledPatterns = [
    // "Fecha de emisión/creación/documento: 15 de mayo de 2021"
    /fecha\s+(?:de\s+)?(?:emisi[oó]n|creaci[oó]n|elaboraci[oó]n|del?\s+documento|publicaci[oó]n)?[\s:,]+(\d{1,2})\s+de\s+([a-záéíóúü]+)\s+de\s+(\d{4})/i,
    // "Fecha: 03/04/2022"
    /fecha[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    // "Santiago, 12 de marzo de 2020" / "Valparaíso, enero de 2019"
    /[A-ZÁÉÍÓÚ][a-záéíóúü]+,\s+(?:(\d{1,2})\s+de\s+)?([a-záéíóúü]+)\s+de\s+(\d{4})/,
    // "Año 2021" solo (último recurso dentro del texto)
    /a[ñn]o[\s:]+(\d{4})/i,
  ];

  for (const pattern of labeledPatterns) {
    const m = text.match(pattern);
    if (!m) continue;

    // Patrón "Fecha de emisión: 15 de mayo de 2021"
    if (m[1] && m[2] && m[3] && isNaN(m[1])) {
      // m[1] podría ser mes si el día está ausente
    }
    if (m.length >= 4 && m[1] && m[2] && m[3]) {
      // day=m[1], month=m[2], year=m[3]
      const date = parseNamedDate(m[1], m[2], m[3]);
      if (date) return date;
    }
    // Patrón "Fecha: DD/MM/YYYY"
    if (m[1] && /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(m[1])) {
      const date = parseNumericDate(m[1]);
      if (date) return date;
    }
    // Patrón "Ciudad, [día de] mes de año" — m[1]=día(opcional), m[2]=mes, m[3]=año
    if (m[2] && m[3] && isNaN(Number(m[1] || 'x'))) {
      const date = parseNamedDate(m[1] || '1', m[2], m[3]);
      if (date) return date;
    }
    // Patrón "Año YYYY"
    if (m[1] && /^\d{4}$/.test(m[1])) {
      const y = parseInt(m[1], 10);
      if (y >= 1990 && y <= 2100) return new Date(y, 0, 1);
    }
  }

  // ── 2. Buscar "de <mes> de <año>" genérico en todo el texto ──────────────
  const genericMonth = /\b(\d{1,2})\s+de\s+([a-záéíóúü]{4,})\s+de\s+(\d{4})\b/gi;
  let best = null;
  let match;
  while ((match = genericMonth.exec(text)) !== null) {
    const date = parseNamedDate(match[1], match[2], match[3]);
    if (date) {
      // Preferir la fecha más antigua encontrada (probable fecha de emisión)
      if (!best || date < best) best = date;
    }
  }
  if (best) return best;

  // ── 3. Fallback: año en el nombre del archivo ─────────────────────────────
  return extractFromFileName(fileName);
}

/**
 * Intenta extraer un año del nombre del archivo como último recurso.
 * Ej: "Informe_Indicadores_2021.pdf" → 2021-01-01
 */
function extractFromFileName(fileName) {
  if (!fileName) return null;
  const m = fileName.match(/\b(20\d{2}|19\d{2})\b/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return new Date(y, 0, 1);
}
