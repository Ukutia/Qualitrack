import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Criterio 9 CNA · "Gestión y resultados del aseguramiento interno de la calidad" ──
// La matriz de la CNA organiza el criterio en TRES NIVELES acumulativos:
//   Nivel 1 → piso mínimo obligatorio para acreditar.
//   Nivel 2 → exigido para optar a una acreditación avanzada (requiere el Nivel 1).
//   Nivel 3 → excelencia (requiere los niveles 1 y 2).
// Cada nivel se desglosa en subcriterios verificables.
//
// Las keywords quedan en la BD como referencia documental (el clasificador HU01
// usa exclusivamente la IA, ya no el respaldo por keywords) y acceptedEvidenceTypes
// el detalle de cumplimiento (HU02). Son configurables.

export const LEVELS = {
  1: {
    title: 'Cumplimiento obligatorio',
    description:
      'Piso mínimo para acreditarse. Si falla uno solo de estos subcriterios, la universidad ' +
      'arriesga no acreditar o quedar con una acreditación muy baja.',
  },
  2: {
    title: 'Acreditación avanzada',
    description:
      'Requiere todo el Nivel 1. Se evalúa que el sistema sea sistemático y formalizado, ' +
      'no un esfuerzo de última hora.',
  },
  3: {
    title: 'Excelencia',
    description:
      'La calidad ya no es un control, sino la forma natural en que la universidad opera ' +
      'en su día a día.',
  },
};

const SUBCRITERIA = [
  // ── Nivel 1 · Cumplimiento obligatorio ───────────────────────────────
  {
    code: '9.1.1',
    level: 1,
    required: true,
    name: 'Institucionalidad de la calidad',
    description:
      'Existe una política de aseguramiento interno de la calidad y responsables de su implementación. ' +
      'Propende al fortalecimiento de las capacidades de autorregulación y de mejoramiento continuo, ' +
      'y es coherente con la misión, valores y propósitos institucionales.',
    keywords: [
      'política de calidad', 'aseguramiento interno de la calidad', 'dirección de calidad',
      'organigrama', 'decreto', 'resolución', 'plan de desarrollo estratégico', 'PDE',
      'misión', 'propósitos institucionales', 'responsables de la implementación',
    ],
    acceptedEvidenceTypes: [
      'Decreto o resolución que aprueba la Política de Calidad',
      'Organigrama donde figura la Dirección de Calidad u homóloga',
      'Actas que alinean la política con el Plan de Desarrollo Estratégico (PDE)',
    ],
  },
  {
    code: '9.1.2',
    level: 1,
    required: true,
    name: 'Monitoreo del desempeño',
    description:
      'La universidad recoge y procesa información sobre los resultados de su desempeño, en cuanto al ' +
      'cumplimiento de los criterios y estándares, para todas las dimensiones y sus políticas internas, ' +
      'y la utiliza para identificar áreas a mejorar.',
    keywords: [
      'informe de gestión', 'indicadores institucionales', 'retención', 'titulación oportuna',
      'encuesta de satisfacción', 'autoevaluación institucional', 'resultados de desempeño',
      'áreas de mejora', 'deserción',
    ],
    acceptedEvidenceTypes: [
      'Informes de gestión anuales',
      'Reportes de tasas de retención y titulación oportuna',
      'Encuestas de satisfacción docente y estudiantil',
      'Informe de Autoevaluación Institucional vigente',
    ],
  },
  {
    code: '9.1.3',
    level: 1,
    required: true,
    name: 'Transparencia y acceso a la información',
    description:
      'La información sobre el desempeño institucional es accesible para los distintos actores: ' +
      'directivos, facultades y otras unidades organizativas.',
    keywords: [
      'transparencia', 'acceso a la información', 'intranet', 'análisis institucional',
      'Power BI', 'Tableau', 'tablero de control', 'reportería', 'indicadores en línea',
      'decanos', 'directores de escuela', 'jefes de carrera',
    ],
    acceptedEvidenceTypes: [
      'Capturas o credenciales de la plataforma de Análisis Institucional (Power BI, Tableau u otra)',
      'Reportes por facultad, escuela o carrera visibles para sus directivos',
      'Política o procedimiento de difusión interna de la información institucional',
    ],
  },

  // ── Nivel 2 · Acreditación avanzada ──────────────────────────────────
  {
    code: '9.2.1',
    level: 2,
    required: false,
    name: 'Formalización de mecanismos e indicadores',
    description:
      'La universidad cuenta con mecanismos formalizados y sistemas de información que le permiten ' +
      'gestionar internamente la calidad para avanzar en el cumplimiento de los criterios y estándares, ' +
      'y enriquecerlos desde su proyecto.',
    keywords: [
      'manual de procedimientos', 'creación de carreras', 'rediseño curricular',
      'reglamento de evaluación docente', 'cuadro de mando integral', 'KPI',
      'sistema de información', 'alerta de desviación', 'metas',
    ],
    acceptedEvidenceTypes: [
      'Manual de procedimientos para la creación y rediseño de carreras',
      'Reglamento de evaluación docente obligatorio',
      'Cuadro de Mando Integral (KPI) automatizado con alertas de desviación',
    ],
  },
  {
    code: '9.2.2',
    level: 2,
    required: false,
    name: 'Instalación de una cultura de calidad transversal',
    description:
      'La universidad promueve una cultura de calidad que contempla la participación y responsabilidad ' +
      'de todos sus estamentos.',
    keywords: [
      'cultura de calidad', 'participación', 'estamentos', 'consejo académico',
      'capacitación', 'taller de acreditación', 'tasa de respuesta', 'encuesta institucional',
      'funcionarios', 'estudiantes',
    ],
    acceptedEvidenceTypes: [
      'Actas de consejos académicos con participación de estudiantes y funcionarios',
      'Reportes de tasa de respuesta de las encuestas institucionales',
      'Registros de talleres o capacitaciones sobre el proceso de acreditación',
    ],
  },

  // ── Nivel 3 · Excelencia ─────────────────────────────────────────────
  {
    code: '9.3.1',
    level: 3,
    required: false,
    name: 'Autorregulación autónoma y madurez del sistema',
    description:
      'El sistema interno de aseguramiento de la calidad garantiza la capacidad de autorregulación y ' +
      'el mejoramiento continuo de todas las funciones institucionales.',
    keywords: [
      'autorregulación', 'mejoramiento continuo', 'plan de mejora cerrado',
      'presupuesto ejecutado', 'auditoría externa', 'seguimiento de compromisos',
      'brechas históricas',
    ],
    acceptedEvidenceTypes: [
      'Planes de mejora anteriores cerrados con éxito',
      'Presupuestos asignados y ejecutados para resolver brechas históricas',
      'Auditorías externas al propio sistema de aseguramiento de la calidad',
    ],
  },
  {
    code: '9.3.2',
    level: 3,
    required: false,
    name: 'Compromiso y coherencia estamental total',
    description:
      'Se evidencia el compromiso de cada uno de los estamentos y personas con la cultura de calidad ' +
      'institucional en todo su quehacer: cualquier estudiante, académico o administrativo puede ' +
      'explicar cómo su rol aporta a la calidad de la universidad.',
    keywords: [
      'compromiso estamental', 'pares evaluadores', 'entrevistas', 'socialización',
      'apropiación de la calidad', 'quehacer institucional', 'testimonios',
    ],
    acceptedEvidenceTypes: [
      'Registros de socialización con estudiantes, académicos y administrativos',
      'Preparación y ensayos de entrevistas con pares evaluadores',
      'Evidencias de apropiación de la cultura de calidad en las unidades',
    ],
  },
];

// ── Estructura oficial del informe CNA (versión 1) ─────────────────────
const REPORT_SECTIONS = [
  { code: '1', name: 'Presentación de la institución y del programa', description: 'Antecedentes generales de la institución y de la carrera evaluada.', required: true },
  { code: '2', name: 'Marco de referencia del Criterio 9', description: 'Descripción del criterio "Gestión y resultados del aseguramiento interno de la calidad" y de sus tres niveles según la CNA.', required: true },
  { code: '3', name: 'Sistema interno de aseguramiento de la calidad', description: 'Política, responsables, mecanismos formalizados y sistemas de información institucionales.', required: true },
  { code: '4', name: 'Análisis de evidencias por nivel y subcriterio', description: 'Análisis de la evidencia disponible para cada subcriterio de los niveles 1, 2 y 3.', required: true },
  { code: '5', name: 'Fortalezas y debilidades', description: 'Síntesis de fortalezas y debilidades detectadas en el proceso.', required: true },
  { code: '6', name: 'Plan de mejora', description: 'Acciones correctivas, responsables y plazos asociados a las debilidades.', required: true },
  { code: '7', name: 'Anexos y evidencias documentales', description: 'Listado y enlaces a la evidencia documental de respaldo.', required: false },
];

/**
 * Elimina los subcriterios que ya no forman parte de la matriz vigente.
 * Por seguridad, los que todavía tienen asociaciones NO se borran: solo se avisa.
 * Para forzar el borrado (incluyendo sus asociaciones e historial) ejecutar el
 * seed con PRUNE_OBSOLETE_SUBCRITERIA=true.
 */
async function pruneObsoleteSubcriteria(criterionId, validCodes) {
  const obsolete = await prisma.subcriterion.findMany({
    where: { criterionId, code: { notIn: validCodes } },
    include: { _count: { select: { associations: true } } },
  });
  if (obsolete.length === 0) return;

  const force = String(process.env.PRUNE_OBSOLETE_SUBCRITERIA).toLowerCase() === 'true';

  for (const s of obsolete) {
    const used = s._count.associations;
    if (used > 0 && !force) {
      console.warn(
        `! Subcriterio obsoleto ${s.code} "${s.name}" tiene ${used} asociación(es) y NO se eliminó. ` +
          'Reasigne esas evidencias o ejecute el seed con PRUNE_OBSOLETE_SUBCRITERIA=true.'
      );
      continue;
    }
    if (used > 0) {
      const assocs = await prisma.association.findMany({
        where: { subcriterionId: s.id },
        select: { id: true },
      });
      const ids = assocs.map((a) => a.id);
      await prisma.associationHistory.deleteMany({ where: { associationId: { in: ids } } });
      await prisma.association.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.subcriterion.delete({ where: { id: s.id } });
    console.log(
      `✓ Subcriterio obsoleto eliminado: ${s.code} "${s.name}"${used ? ` (+${used} asociación/es)` : ''}`
    );
  }
}

async function main() {
  // 1) Admin
  const email = process.env.ADMIN_EMAIL || 'admin@qualitrack.cl';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Encargado de Aseguramiento de Calidad';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { name, role: 'admin' },
    create: { email, name, passwordHash, role: 'admin' },
  });
  console.log(`✓ Admin: ${email}`);

  // 2) Criterio 9 + subcriterios por nivel
  const CRITERION_NAME = 'Gestión y resultados del aseguramiento interno de la calidad';
  const CRITERION_DESCRIPTION =
    'La universidad define, implementa, monitorea y optimiza su sistema interno de aseguramiento de ' +
    'la calidad. Cada miembro de la institución asume la calidad como su propia responsabilidad, y se ' +
    'advierte que la universidad orienta todo su quehacer hacia ella. Se evalúa en tres niveles ' +
    'acumulativos: obligatorio, avanzado y de excelencia.';

  const criterion = await prisma.criterion.upsert({
    where: { code: '9' },
    update: { name: CRITERION_NAME, description: CRITERION_DESCRIPTION },
    create: { code: '9', name: CRITERION_NAME, description: CRITERION_DESCRIPTION },
  });

  for (const sub of SUBCRITERIA) {
    await prisma.subcriterion.upsert({
      where: { criterionId_code: { criterionId: criterion.id, code: sub.code } },
      update: {
        name: sub.name,
        description: sub.description,
        level: sub.level,
        required: sub.required,
        keywords: sub.keywords,
        acceptedEvidenceTypes: sub.acceptedEvidenceTypes,
      },
      create: { ...sub, criterionId: criterion.id },
    });
  }
  const porNivel = [1, 2, 3]
    .map((n) => `N${n}: ${SUBCRITERIA.filter((s) => s.level === n).length}`)
    .join(' · ');
  console.log(`✓ Criterio 9 + ${SUBCRITERIA.length} subcriterios (${porNivel})`);

  await pruneObsoleteSubcriteria(
    criterion.id,
    SUBCRITERIA.map((s) => s.code)
  );

  // 3) Estructura del informe (solo si no existe ninguna versión)
  const existing = await prisma.reportStructureVersion.findFirst();
  if (!existing) {
    const v = await prisma.reportStructureVersion.create({
      data: { version: 1, active: true },
    });
    await prisma.reportSection.createMany({
      data: REPORT_SECTIONS.map((s, i) => ({
        versionId: v.id,
        code: s.code,
        name: s.name,
        description: s.description,
        required: s.required,
        order: i,
        changeType: 'NONE',
      })),
    });
    console.log(`✓ Estructura del informe v1 (${REPORT_SECTIONS.length} secciones)`);
  } else {
    console.log('• Estructura del informe ya existe, se omite');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
