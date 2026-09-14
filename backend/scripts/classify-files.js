// Clasifica documentos reales desde el disco, sin base de datos ni servidor.
//
//   node scripts/classify-files.js ../ejemplos-evidencia
//   node scripts/classify-files.js "C:\ruta\a\un.pdf"
//   node scripts/classify-files.js carpeta --provider gemini
//   node scripts/classify-files.js carpeta --json > resultados.json
//
// Sirve para evaluar la calidad del clasificador sobre tus propios PDF/DOCX/XLSX
// antes de cargarlos a la aplicación. No escribe nada en la BD ni en disco.

import fs from 'node:fs/promises';
import path from 'node:path';

import { extractText } from '../src/services/textExtraction.service.js';
import { classifyText } from '../src/services/classifier.service.js';
import { checkLlmAvailable, LLM_MODEL } from '../src/services/llm.service.js';
import { SUBCRITERIA } from '../test/fixtures/subcriteria.js';

const EXTENSIONS = {
  '.pdf': 'pdf',
  '.doc': 'docx',
  '.docx': 'docx',
  '.xls': 'xlsx',
  '.xlsx': 'xlsx',
};

async function collectFiles(target) {
  const stats = await fs.stat(target);

  if (stats.isFile()) return [target];

  const entries = await fs.readdir(target, { withFileTypes: true });

  return entries
    .filter((e) => e.isFile() && EXTENSIONS[path.extname(e.name).toLowerCase()])
    .map((e) => path.join(target, e.name));
}

/**
 * Los subcriterios salen de la BD si está disponible (fuente de verdad), y si
 * no del fixture del test. Se avisa cuál se usó para que un resultado nunca se
 * interprete contra la taxonomía equivocada.
 */
async function loadSubcriteria() {
  try {
    const { prisma } = await import('../src/config/prisma.js');
    const fromDb = await prisma.subcriterion.findMany({
      where: { criterion: { code: '9' } },
      orderBy: { code: 'asc' },
    });
    await prisma.$disconnect();

    if (fromDb.length > 0) {
      return { subcriteria: fromDb, origen: 'base de datos' };
    }
  } catch {
    // Sin BD disponible: se sigue con el fixture.
  }

  return { subcriteria: SUBCRITERIA, origen: 'fixture test/fixtures/subcriteria.js' };
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const asJson = args.includes('--json');
  const providerArg = args.indexOf('--provider');

  if (!target) {
    console.error('Uso: node scripts/classify-files.js <archivo-o-carpeta> [--provider local|gemini|keywords] [--json]');
    process.exitCode = 1;
    return;
  }

  const provider = providerArg !== -1 ? args[providerArg + 1] : 'local';
  process.env.CLASSIFIER_PROVIDER = provider;

  if (provider === 'local') {
    const estado = await checkLlmAvailable();
    if (!estado.available) {
      console.error(`El LLM local no está disponible: ${estado.reason}`);
      process.exitCode = 1;
      return;
    }
  }

  const files = await collectFiles(target);

  if (files.length === 0) {
    console.error(`No se encontraron archivos PDF, DOC, DOCX, XLS o XLSX en ${target}`);
    process.exitCode = 1;
    return;
  }

  const { subcriteria, origen } = await loadSubcriteria();

  if (!asJson) {
    console.log(`Proveedor: ${provider}${provider === 'local' ? ` (${LLM_MODEL})` : ''}`);
    console.log(`Subcriterios: ${subcriteria.length}, desde ${origen}`);
    console.log(`Archivos: ${files.length}\n`);
  }

  const resultados = [];

  for (const file of files) {
    const nombre = path.basename(file);
    const format = EXTENSIONS[path.extname(file).toLowerCase()];

    try {
      const buffer = await fs.readFile(file);
      const texto = await extractText(buffer, format);

      if (!texto || !texto.trim()) {
        resultados.push({ archivo: nombre, error: 'Sin texto extraíble (¿PDF escaneado?)' });
        if (!asJson) console.log(`${nombre}\n  Sin texto extraíble — probablemente es un PDF escaneado.\n`);
        continue;
      }

      const started = Date.now();
      const r = await classifyText(texto, subcriteria);
      const seg = ((Date.now() - started) / 1000).toFixed(1);

      const salida = {
        archivo: nombre,
        caracteres: texto.length,
        relevante: r.relevant,
        subcriterio: r.subcriterion ? `${r.subcriterion.code} ${r.subcriterion.name}` : null,
        confianza: r.confidence,
        justificacion: r.justification,
        cita: r.evidenceFragment,
        segundos: Number(seg),
      };

      resultados.push(salida);

      if (!asJson) {
        console.log(`${nombre}  (${texto.length} chars, ${seg}s)`);
        if (r.relevant) {
          console.log(`  -> ${salida.subcriterio}  [confianza ${r.confidence}]`);
        } else {
          console.log('  -> NO relevante para el Criterio 9');
        }
        console.log(`  ${r.justification}`);
        if (r.evidenceFragment) console.log(`  Cita: "${r.evidenceFragment}"`);
        console.log();
      }
    } catch (err) {
      resultados.push({ archivo: nombre, error: err.message });
      if (!asJson) console.log(`${nombre}\n  ERROR: ${err.message}\n`);
    }
  }

  if (asJson) {
    console.log(JSON.stringify(resultados, null, 2));
    return;
  }

  const relevantes = resultados.filter((r) => r.relevante).length;
  const errores = resultados.filter((r) => r.error).length;

  console.log('─'.repeat(60));
  console.log(`${resultados.length} procesados | ${relevantes} relevantes | ${errores} con error`);

  const porSubcriterio = {};
  for (const r of resultados) {
    if (!r.subcriterio) continue;
    const code = r.subcriterio.split(' ')[0];
    porSubcriterio[code] = (porSubcriterio[code] || 0) + 1;
  }

  if (Object.keys(porSubcriterio).length > 0) {
    console.log('\nDistribución por subcriterio:');
    for (const [code, n] of Object.entries(porSubcriterio).sort()) {
      console.log(`  ${code}: ${n}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
