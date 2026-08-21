import { prisma } from "./src/config/prisma.js";
import { searchSimilarChunks } from "./src/services/vector.service.js";

const query =
  "cómo se elaboró y validó el perfil de egreso de Ingeniería Civil";

async function main() {
  console.log("\nConsulta:");
  console.log(query);

  const results = await searchSimilarChunks(query, {
    limit: 5,
  });

  console.log("\n=== TOP RESULTADOS ===\n");

  results.forEach((result, index) => {
    console.log(`#${index + 1}`);

    console.log(
      `Documento: ${result.originalName}`
    );

    console.log(
      `Documento ID: ${result.documentId}`
    );

    console.log(
      `Chunk: ${result.chunkIndex}`
    );

    console.log(
      `Modelo: ${result.embeddingModel}`
    );

    console.log(
      `Similitud: ${result.similarity.toFixed(4)}`
    );

    console.log("Contenido:");

    console.log(
      result.content.slice(0, 500)
    );

    console.log(
      "\n-------------------------------------\n"
    );
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });