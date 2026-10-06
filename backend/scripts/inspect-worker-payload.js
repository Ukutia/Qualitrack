// Guarda en disco lo que el backend transmitiría al worker para un documento,
// junto a su contenido en claro, para comprobar a ojo que lo enviado es
// ilegible (CDA2). No cambia el estado del documento ni contacta al worker.
//
// Uso (dentro del contenedor del backend):
//   node scripts/inspect-worker-payload.js <documentId> [carpeta]
//
// Deja en la carpeta (por defecto ./evidencia-cda2):
//   doc-<id>-original.<ext>       el contenido antes de cifrar
//   doc-<id>-transmitido.json     el cuerpo tal cual sale a la red
//   doc-<id>-transmitido.bin      los bytes cifrados, para abrirlos como archivo
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/config/prisma.js';
import {
  plainWorkerContent,
  encryptedWorkerContent,
  decryptWorkerContent,
} from '../src/services/workerPayload.service.js';

const id = Number(process.argv[2]);
const outDir = path.resolve(process.argv[3] || 'evidencia-cda2');

if (!Number.isInteger(id) || id <= 0) {
  console.error('Uso: node scripts/inspect-worker-payload.js <documentId> [carpeta]');
  process.exit(1);
}

const doc = await prisma.document.findFirst({ where: { id, deletedAt: null } });
if (!doc) {
  console.error(`Documento ${id} no encontrado.`);
  process.exit(1);
}

const { contenido, formato } = await plainWorkerContent(doc);
const payload = await encryptedWorkerContent(doc);
const cifrado = Buffer.from(payload.fileData, 'base64');

await fs.mkdir(outDir, { recursive: true });
const base = path.join(outDir, `doc-${id}`);
await fs.writeFile(`${base}-original.${formato === 'text' ? 'txt' : formato}`, contenido);
await fs.writeFile(`${base}-transmitido.json`, JSON.stringify({ documentId: id, ...payload }, null, 2));
await fs.writeFile(`${base}-transmitido.bin`, cifrado);

// Una frase del original para buscarla dentro de lo transmitido.
const muestra = contenido.toString('utf-8').replace(/\s+/g, ' ').trim().slice(0, 40);
const iguales = contenido.length === cifrado.length
  ? contenido.reduce((n, byte, i) => n + (byte === cifrado[i] ? 1 : 0), 0)
  : null;

console.log(`Documento ${id}: ${doc.originalName}`);
console.log(`Formato transmitido: ${formato} · ${contenido.length} bytes`);
console.log('');
console.log('Original (primeros 120 caracteres):');
console.log(`  ${contenido.toString('utf-8').slice(0, 120).replace(/\s+/g, ' ')}`);
console.log('Transmitido (primeros 120 caracteres de fileData):');
console.log(`  ${payload.fileData.slice(0, 120)}`);
console.log('');
console.log(`¿Aparece "${muestra}" en lo transmitido?`, cifrado.includes(muestra) || payload.fileData.includes(muestra) ? 'SÍ' : 'NO');
if (iguales !== null) {
  console.log(`Bytes que coinciden en la misma posición: ${iguales} de ${contenido.length} (${((iguales / contenido.length) * 100).toFixed(2)} %)`);
}
console.log('¿El worker lo recupera intacto con la clave?', decryptWorkerContent(payload).equals(contenido) ? 'SÍ' : 'NO');
console.log('');
console.log(`Archivos guardados en ${outDir}`);

await prisma.$disconnect();
