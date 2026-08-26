import { prisma } from './src/config/prisma.js';
import { vectorizeDocument } from './src/services/vector.service.js';
import { classifyDocumentByEmbeddings } from './src/services/classifier.service.js';

const TESTS = [
  {
    expected: '9.1',
    name: 'calidad.txt',
    text: `
La carrera cuenta con un sistema interno de aseguramiento de la calidad.
El comité de calidad realiza procesos periódicos de autoevaluación,
revisa indicadores y propone acciones de mejora continua.

Las políticas institucionales establecen mecanismos formales para
monitorear el cumplimiento de los objetivos del programa y verificar
la aplicación de los procesos de calidad.
    `,
  },
  {
    expected: '9.2',
    name: 'perfil-egreso.txt',
    text: `
El perfil de egreso de la carrera establece las competencias que deben
alcanzar los estudiantes al finalizar su formación.

El plan de estudios y la malla curricular fueron diseñados en coherencia
con dichas competencias. Los programas de asignatura identifican
resultados de aprendizaje y su contribución al perfil de egreso.
    `,
  },
  {
    expected: '9.3',
    name: 'progresion.txt',
    text: `
La carrera realiza seguimiento anual de los indicadores estudiantiles.
Se analizan las tasas de aprobación, retención, deserción, titulación
y tiempo promedio de egreso.

Además, se realiza seguimiento de egresados y se estudian periódicamente
los niveles de empleabilidad de los titulados.
    `,
  },
  {
    expected: '9.4',
    name: 'docentes-recursos.txt',
    text: `
La unidad académica mantiene una dotación de profesores de jornada
completa y parcial suficiente para las actividades docentes.

Se implementan programas de perfeccionamiento docente y se dispone de
laboratorios, salas, equipamiento e infraestructura adecuada para
desarrollar las actividades de enseñanza.
    `,
  },
  {
    expected: '9.5',
    name: 'vinculacion-mejora.txt',
    text: `
El programa mantiene un plan de mejora con acciones correctivas,
responsables, fechas y mecanismos de seguimiento.

También desarrolla actividades de vinculación con el medio y mantiene
un consejo asesor con empleadores, quienes entregan retroalimentación
sobre las necesidades del entorno profesional.
    `,
  },

  // Casos que NO deberían corresponder al Criterio 9.
  {
    expected: 'NONE',
    name: 'receta.txt',
    text: `
Para preparar pan se debe mezclar harina, agua, levadura y sal.
La masa debe amasarse durante varios minutos y luego dejarse reposar.
Finalmente se hornea hasta obtener una corteza dorada.
    `,
  },
  {
    expected: 'NONE',
    name: 'turismo.txt',
    text: `
Durante el viaje se visitaron parques nacionales, playas y diversos
atractivos turísticos. El itinerario contempló transporte, alojamiento
y actividades recreativas durante cinco días.
    `,
  },
  {
    expected: 'NONE',
    name: 'mantencion-auto.txt',
    text: `
El vehículo requiere cambio de aceite, revisión de frenos, alineación
de las ruedas y verificación de la presión de los neumáticos.
El fabricante recomienda realizar mantenimiento periódico del motor.
    `,
  },
];

async function main() {
  const user = await prisma.user.findFirst();

  if (!user) {
    throw new Error('No existe usuario para ejecutar las pruebas.');
  }

  const subcriteria = await prisma.subcriterion.findMany({
    where: {
      criterion: {
        code: '9',
      },
    },
    orderBy: {
      code: 'asc',
    },
  });

  const rows = [];
  const createdDocumentIds = [];

  try {
    for (let i = 0; i < TESTS.length; i++) {
      const test = TESTS[i];

      console.log(`\nProcesando ${test.name}...`);

      const document = await prisma.document.create({
        data: {
          originalName: test.name,
          storedName: `qwen-test-${Date.now()}-${i}-${test.name}`,
          format: 'txt',
          sizeBytes: Buffer.byteLength(test.text, 'utf8'),
          storagePath: `test://${test.name}`,
          extractedText: test.text,
          uploadedById: user.id,
        },
      });

      createdDocumentIds.push(document.id);

      await vectorizeDocument(
        document.id,
        test.text
      );

      const result = await classifyDocumentByEmbeddings(
        document.id,
        subcriteria
      );

      const ranking = result.semanticRanking || [];

      const first = ranking[0] || null;
      const second = ranking[1] || null;

      const margin =
        first && second
          ? Number((first.score - second.score).toFixed(4))
          : null;

      const predicted =
        result.relevant
          ? first?.code ?? 'NONE'
          : 'NONE';

      rows.push({
        archivo: test.name,
        esperado: test.expected,
        predicho: predicted,
        score1: first?.score ?? null,
        score2: second?.score ?? null,
        margen: margin,
        correcto:
          predicted === test.expected
            ? 'SI'
            : 'NO',
      });
    }

    console.log('\n=== RESULTADOS ===\n');
    console.table(rows);
  } finally {
    if (createdDocumentIds.length > 0) {
      await prisma.document.deleteMany({
        where: {
          id: {
            in: createdDocumentIds,
          },
        },
      });

      console.log('\nDocumentos temporales eliminados.');
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });