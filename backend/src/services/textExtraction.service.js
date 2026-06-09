// Extracción de texto plano desde PDF / DOCX / XLSX para alimentar el
// clasificador (HU01). Best-effort: si falla, devuelve string vacío.
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// pdf-parse exporta CommonJS; lo importamos dinámicamente para evitar que
// su "debug mode" intente leer un archivo de prueba al cargar el módulo.
async function extractPdf(buffer) {
  const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function extractDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value || '';
}

function extractXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    return `# ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`;
  }).join('\n\n');
}

/**
 * @param {Buffer} buffer
 * @param {'pdf'|'docx'|'xlsx'} format
 * @returns {Promise<string>}
 */
export async function extractText(buffer, format) {
  try {
    if (format === 'pdf') return await extractPdf(buffer);
    if (format === 'docx') return await extractDocx(buffer);
    if (format === 'xlsx') return extractXlsx(buffer);
    return '';
  } catch (err) {
    console.error(`Extracción de texto falló (${format}):`, err.message);
    return '';
  }
}
