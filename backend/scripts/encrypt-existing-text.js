// Migra una sola vez las filas históricas que almacenaban texto en claro.
// Ejecutar con DOC_ENCRYPTION_KEY configurada: node scripts/encrypt-existing-text.js
import { prisma } from '../src/config/prisma.js';
import { encryptText, isEncryptedText } from '../src/services/encryption.service.js';

async function encryptLegacyText() {
  const documents = await prisma.document.findMany({
    where: { extractedText: { not: null } },
    select: { id: true, extractedText: true },
  });
  const chunks = await prisma.documentChunk.findMany({
    select: { id: true, content: true },
  });

  const legacyDocuments = documents.filter((row) => !isEncryptedText(row.extractedText));
  const legacyChunks = chunks.filter((row) => !isEncryptedText(row.content));

  await prisma.$transaction([
    ...legacyDocuments.map((row) => prisma.document.update({
      where: { id: row.id }, data: { extractedText: encryptText(row.extractedText) },
    })),
    ...legacyChunks.map((row) => prisma.documentChunk.update({
      where: { id: row.id }, data: { content: encryptText(row.content) },
    })),
  ]);

  console.log(`Migrados ${legacyDocuments.length} extractedText y ${legacyChunks.length} chunks.`);
}

encryptLegacyText()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
