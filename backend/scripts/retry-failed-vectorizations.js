import { prisma } from '../src/config/prisma.js';
import { decryptText } from '../src/services/encryption.service.js';
import { vectorizeDocument } from '../src/services/vector.service.js';

// Run explicitly after the local embedding service is healthy. No file upload
// or association changes: rebuild only failed documents' vector chunks.
async function main() {
  const url = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000';
  const health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10000) });
  if (!health.ok) throw new Error(`El servicio de embeddings no está listo (${health.status}).`);

  const documents = await prisma.document.findMany({
    where: { deletedAt: null, vectorizationStatus: 'FAILED' },
    select: { id: true }, orderBy: { id: 'asc' },
  });
  console.log(`Documentos con vectorización fallida: ${documents.length}`);
  let failed = 0;
  for (const { id } of documents) {
    // Avoid two recovery commands processing the same document simultaneously.
    const claim = await prisma.document.updateMany({
      where: { id, deletedAt: null, vectorizationStatus: 'FAILED' },
      data: { vectorizationStatus: 'PROCESSING' },
    });
    if (!claim.count) continue;
    try {
      const document = await prisma.document.findUnique({ where: { id }, select: { extractedText: true } });
      if (!document) continue;
      const text = decryptText(document.extractedText) || '';
      if (!text.trim()) throw new Error('El documento no tiene texto extraído; requiere revisar el archivo original.');
      await vectorizeDocument(id, text);
      await prisma.document.updateMany({ where: { id, vectorizationStatus: 'PROCESSING' }, data: { vectorizationStatus: 'READY' } });
      console.log(`Documento ${id}: READY`);
    } catch (error) {
      failed++;
      await prisma.document.updateMany({ where: { id, vectorizationStatus: 'PROCESSING' }, data: { vectorizationStatus: 'FAILED' } });
      console.error(`Documento ${id}: ${error.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`No se pudo completar la recuperación: ${error.message}`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
