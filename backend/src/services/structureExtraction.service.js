// HU03 — Detección de la estructura (títulos / secciones) de un informe CNA
// a partir de un archivo PDF o DOCX.
//
// Una sección puede detectarse de dos formas:
//   • Explícita: usa formato de encabezado en el documento (estilos Heading de
//     Word → etiquetas <h1>…<h6> al convertir a HTML con mammoth).
//   • Implícita: líneas que parecen títulos por su forma (numeración "1.",
//     "1.1", la palabra "Sección/Capítulo/Anexo", o líneas en MAYÚSCULAS).
import mammoth from 'mammoth';
import { extractText } from './textExtraction.service.js';

// "1. Introducción", "1.1 Objetivos", "2) Marco", etc.
const NUMBERING = /^\d+(?:\.\d+)*[.)]?\s+\S/;
// "Sección 1", "Capítulo II", "Título III", "Anexo A".
const SECTION_WORD = /^(secci[oó]n|cap[ií]tulo|t[ií]tulo|anexo)\b/i;

const normalize = (s) =>
  String(s).trim().toLowerCase().replace(/\s+/g, ' ');

/** ¿La línea parece un título de sección (detección implícita)? */
function isHeadingLike(line) {
  const t = line.trim();
  if (t.length < 3 || t.length > 120) return false;
  if (NUMBERING.test(t)) return true;
  if (SECTION_WORD.test(t)) return true;
  // Mayúsculas: la mayoría de las letras en mayúscula y pocas palabras.
  const letters = t.replace(/[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/g, '');
  if (letters.length >= 3 && letters === letters.toUpperCase() && t.split(/\s+/).length <= 12) {
    return true;
  }
  return false;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
}

/** Títulos explícitos desde los encabezados de un DOCX, en orden del documento. */
async function explicitDocxHeadings(buffer) {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const titles = [];
  const re = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis;
  let m;
  while ((m = re.exec(html))) {
    const text = stripTags(m[1]);
    if (text) titles.push(text);
  }
  return titles;
}

/** Títulos implícitos desde el texto plano del documento. */
async function implicitFromText(buffer, format) {
  const text = await extractText(buffer, format);
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(isHeadingLike);
}

/**
 * Detecta las secciones de un archivo de informe.
 * @param {Buffer} buffer
 * @param {'pdf'|'docx'} format
 * @returns {Promise<Array<{code: string, name: string}>>} en orden del documento.
 */
export async function extractSections(buffer, format) {
  let titles = [];
  if (format === 'docx') {
    titles = await explicitDocxHeadings(buffer);
  }
  // Si no hubo encabezados explícitos (o es PDF), se usa la heurística de texto.
  if (titles.length === 0) {
    titles = await implicitFromText(buffer, format);
  }

  // Elimina duplicados conservando el orden de aparición.
  const seen = new Set();
  const names = [];
  for (const t of titles) {
    const key = normalize(t);
    if (key && !seen.has(key)) {
      seen.add(key);
      names.push(t);
    }
  }
  // Numeración secuencial (entero positivo) según orden en el documento.
  return names.map((name, i) => ({ code: String(i + 1), name }));
}

/**
 * Compara las secciones de un archivo nuevo con las de la versión anterior e
 * indica explícitamente qué fue agregado, eliminado o renombrado.
 * @returns {Array<{code, name, changeType, previousName?}>}
 */
export function diffSections(oldSecs, newSecs) {
  const oldNames = new Set(oldSecs.map((s) => normalize(s.name)));
  const newNames = new Set(newSecs.map((s) => normalize(s.name)));

  const result = [];
  const usedOldCodes = new Set();
  const remainingNew = [];

  // Nombre presente en ambas versiones → sin cambios.
  for (const s of newSecs) {
    if (oldNames.has(normalize(s.name))) {
      result.push({ code: s.code, name: s.name, changeType: 'NONE' });
    } else {
      remainingNew.push(s);
    }
  }

  // Secciones viejas cuyo nombre desapareció, indexadas por número, para detectar
  // renombres (mismo número, distinto nombre).
  const oldByCode = new Map(
    oldSecs
      .filter((s) => !newNames.has(normalize(s.name)))
      .map((s) => [String(s.code), s])
  );

  for (const s of remainingNew) {
    const old = oldByCode.get(String(s.code));
    if (old && !usedOldCodes.has(String(s.code))) {
      usedOldCodes.add(String(s.code));
      result.push({ code: s.code, name: s.name, changeType: 'RENAMED', previousName: old.name });
    } else {
      result.push({ code: s.code, name: s.name, changeType: 'ADDED' });
    }
  }

  // Lo que quedó del lado viejo y no se renombró → eliminado.
  for (const s of oldSecs) {
    if (!newNames.has(normalize(s.name)) && !usedOldCodes.has(String(s.code))) {
      result.push({ code: s.code, name: s.name, changeType: 'REMOVED' });
    }
  }

  return result;
}
