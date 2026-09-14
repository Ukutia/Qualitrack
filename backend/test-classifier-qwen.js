// Compara proveedores de clasificación (local / gemini / keywords) sobre un
// set fijo de casos, usando la taxonomía real del seed (9.1.1 … 9.3.2).
//
//   node test-classifier-qwen.js              -> local
//   node test-classifier-qwen.js local gemini -> compara ambos
//
// No toca la base de datos: los subcriterios van embebidos para que el test
// corra sin docker ni migraciones.

import { classifyText } from './src/services/classifier.service.js';
import { checkLlmAvailable, LLM_MODEL } from './src/services/llm.service.js';

import { SUBCRITERIA } from './test/fixtures/subcriteria.js';

const TESTS = [
  {
    expected: '9.1.1',
    name: 'politica-calidad.txt',
    text: `Mediante Decreto Universitario N 145 se aprueba la Política de Aseguramiento
Interno de la Calidad. El documento designa a la Dirección de Calidad como
responsable de su implementación y establece su dependencia directa de la
Rectoría en el organigrama institucional. La política declara explícitamente su
coherencia con la misión y los propósitos declarados en el Plan de Desarrollo
Estratégico vigente.`,
  },
  {
    expected: '9.1.2',
    name: 'informe-gestion.txt',
    text: `El informe de gestión anual consolida los indicadores institucionales del
período. Se reportan las tasas de retención de primer año, deserción y titulación
oportuna por facultad. A partir del análisis de estos resultados de desempeño la
Vicerrectoría identifica las áreas a mejorar y prioriza intervenciones para el
año siguiente.`,
  },
  {
    expected: '9.1.3',
    name: 'tablero-bi.txt',
    text: `Se implementó un tablero de control en Power BI administrado por la unidad de
Análisis Institucional. Decanos, directores de escuela y jefes de carrera acceden
mediante credenciales propias a los indicadores en línea de su unidad. El
procedimiento de difusión interna regula qué reportería está disponible para cada
perfil.`,
  },
  {
    expected: '9.2.1',
    name: 'manual-procedimientos.txt',
    text: `El manual de procedimientos formaliza las etapas para la creación de carreras
nuevas y para el rediseño curricular de las existentes. Se acompaña del
reglamento de evaluación docente de aplicación obligatoria. El cuadro de mando
integral automatiza el seguimiento de los KPI y emite alertas cuando un
indicador se desvía de la meta comprometida.`,
  },
  {
    expected: '9.2.2',
    name: 'cultura-calidad.txt',
    text: `Las actas del consejo académico registran la participación de representantes
estudiantiles y de funcionarios administrativos en las decisiones sobre calidad.
Durante el año se ejecutaron talleres de capacitación sobre el proceso de
acreditación dirigidos a todos los estamentos, y se reporta la tasa de respuesta
alcanzada en las encuestas institucionales.`,
  },
  {
    expected: '9.3.1',
    name: 'autorregulacion.txt',
    text: `Los planes de mejora de los dos ciclos anteriores fueron cerrados con
cumplimiento total de sus compromisos. Para ello se asignó y ejecutó presupuesto
específico destinado a resolver brechas históricas. Adicionalmente se contrató
una auditoría externa que evaluó el propio sistema de aseguramiento de la
calidad y verificó su capacidad de autorregulación.`,
  },
  {
    expected: '9.3.2',
    name: 'compromiso-estamental.txt',
    text: `Se registraron jornadas de socialización con estudiantes, académicos y personal
administrativo. Los testimonios recogidos muestran que cada persona puede
explicar cómo su rol aporta a la calidad institucional. Se realizaron ensayos de
entrevistas con pares evaluadores en las distintas unidades como parte de la
apropiación de la cultura de calidad.`,
  },

  // Casos que NO deberían corresponder al Criterio 9.
  {
    expected: 'NONE',
    name: 'receta.txt',
    text: `Para preparar pan se debe mezclar harina, agua, levadura y sal. La masa debe
amasarse durante varios minutos y luego dejarse reposar. Finalmente se hornea
hasta obtener una corteza dorada.`,
  },
  {
    expected: 'NONE',
    name: 'turismo.txt',
    text: `Durante el viaje se visitaron parques nacionales, playas y diversos atractivos
turísticos. El itinerario contempló transporte, alojamiento y actividades
recreativas durante cinco días.`,
  },
  {
    expected: 'NONE',
    name: 'mantencion-auto.txt',
    text: `El vehículo requiere cambio de aceite, revisión de frenos, alineación de las
ruedas y verificación de la presión de los neumáticos. El fabricante recomienda
realizar mantenimiento periódico del motor.`,
  },
];

async function runProvider(provider) {
  process.env.CLASSIFIER_PROVIDER = provider;

  const rows = [];
  let aciertos = 0;
  let totalMs = 0;

  for (const test of TESTS) {
    const started = Date.now();
    const result = await classifyText(test.text, SUBCRITERIA);
    const ms = Date.now() - started;
    totalMs += ms;

    const predicho = result.relevant ? result.subcriterion?.code ?? 'NONE' : 'NONE';
    const correcto = predicho === test.expected;
    if (correcto) aciertos++;

    rows.push({
      archivo: test.name,
      esperado: test.expected,
      predicho,
      conf: result.confidence,
      cita: result.evidenceFragment ? 'si' : 'no',
      seg: (ms / 1000).toFixed(1),
      ok: correcto ? 'SI' : 'NO',
    });
  }

  console.log(`\n=== ${provider.toUpperCase()} ===`);
  console.table(rows);
  console.log(
    `Accuracy: ${aciertos}/${TESTS.length} ` +
      `(${((aciertos / TESTS.length) * 100).toFixed(0)}%) | ` +
      `latencia media: ${(totalMs / TESTS.length / 1000).toFixed(1)}s`
  );

  return { provider, aciertos, total: TESTS.length, totalMs };
}

async function main() {
  const providers = process.argv.slice(2);
  const seleccionados = providers.length > 0 ? providers : ['local'];

  if (seleccionados.includes('local')) {
    const estado = await checkLlmAvailable();
    if (!estado.available) {
      console.error(`No se puede usar el proveedor local: ${estado.reason}`);
      console.error(`Verifica que Ollama esté corriendo y que ${LLM_MODEL} esté descargado.`);
      process.exitCode = 1;
      return;
    }
    console.log(`Modelo local: ${LLM_MODEL}`);
  }

  if (seleccionados.includes('gemini') && !process.env.GEMINI_API_KEY) {
    console.error('No hay GEMINI_API_KEY: se omite el proveedor gemini.');
    seleccionados.splice(seleccionados.indexOf('gemini'), 1);
  }

  const resumen = [];
  for (const provider of seleccionados) {
    resumen.push(await runProvider(provider));
  }

  if (resumen.length > 1) {
    console.log('\n=== COMPARACIÓN ===');
    console.table(
      resumen.map((r) => ({
        proveedor: r.provider,
        accuracy: `${r.aciertos}/${r.total}`,
        'latencia media (s)': (r.totalMs / r.total / 1000).toFixed(1),
      }))
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
