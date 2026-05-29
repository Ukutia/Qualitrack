import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Subcriterios representativos del Criterio 9 de la CNA ───────────────
// "Aseguramiento de la calidad de los programas formativos".
// Las keywords alimentan el clasificador mock (HU01) y acceptedEvidenceTypes
// el detalle de cumplimiento (HU02). Son configurables.
const SUBCRITERIA = [
  {
    code: '9.1',
    name: 'Mecanismos de aseguramiento de la calidad',
    description:
      'Existencia y aplicación sistemática de políticas y mecanismos internos de aseguramiento de la calidad del programa.',
    keywords: [
      'aseguramiento de la calidad', 'política de calidad', 'mecanismo',
      'autoevaluación', 'comité de calidad', 'sistema de gestión de calidad',
      'mejora continua',
    ],
    acceptedEvidenceTypes: [
      'Política institucional de calidad', 'Actas del comité de calidad',
      'Informe de autoevaluación previo', 'Manual de procesos de calidad',
    ],
  },
  {
    code: '9.2',
    name: 'Perfil de egreso y plan de estudios',
    description:
      'Coherencia entre el perfil de egreso, el plan de estudios y las competencias declaradas.',
    keywords: [
      'perfil de egreso', 'plan de estudios', 'malla curricular', 'competencias',
      'asignatura', 'syllabus', 'programa de asignatura', 'resultados de aprendizaje',
    ],
    acceptedEvidenceTypes: [
      'Decreto de plan de estudios', 'Matriz de tributación perfil-asignaturas',
      'Programas de asignatura', 'Documento de perfil de egreso',
    ],
  },
  {
    code: '9.3',
    name: 'Progresión y resultados de los estudiantes',
    description:
      'Seguimiento de tasas de aprobación, retención, titulación y tiempos de egreso.',
    keywords: [
      'retención', 'titulación', 'tasa de aprobación', 'deserción', 'progresión',
      'tiempo de egreso', 'indicadores estudiantiles', 'empleabilidad', 'seguimiento de egresados',
    ],
    acceptedEvidenceTypes: [
      'Reporte de indicadores de progresión', 'Estudio de seguimiento de egresados',
      'Estadísticas de titulación y retención',
    ],
  },
  {
    code: '9.4',
    name: 'Cuerpo docente y recursos',
    description:
      'Suficiencia, calificación y desarrollo del cuerpo docente y de los recursos para la enseñanza.',
    keywords: [
      'cuerpo docente', 'profesores', 'jornada completa', 'perfeccionamiento docente',
      'recursos', 'infraestructura', 'laboratorio', 'dotación académica',
    ],
    acceptedEvidenceTypes: [
      'Planilla de dotación académica', 'Plan de perfeccionamiento docente',
      'Inventario de infraestructura y laboratorios',
    ],
  },
  {
    code: '9.5',
    name: 'Vinculación con el medio y planes de mejora',
    description:
      'Aplicación de planes de mejora y vinculación del programa con el entorno disciplinar y profesional.',
    keywords: [
      'plan de mejora', 'hallazgo', 'vinculación con el medio', 'empleadores',
      'consejo asesor', 'acciones correctivas', 'seguimiento de mejoras',
    ],
    acceptedEvidenceTypes: [
      'Plan de mejora vigente', 'Actas de consejo asesor empresarial',
      'Informe de vinculación con el medio',
    ],
  },
];

// ── Estructura oficial del informe CNA (versión 1) ─────────────────────
const REPORT_SECTIONS = [
  { code: '1', name: 'Presentación de la institución y del programa', description: 'Antecedentes generales de la institución y de la carrera evaluada.', required: true },
  { code: '2', name: 'Marco de referencia del Criterio 9', description: 'Descripción del criterio "Aseguramiento de la calidad de los programas formativos" según la CNA.', required: true },
  { code: '3', name: 'Mecanismos de aseguramiento de la calidad', description: 'Políticas, mecanismos y su aplicación sistemática en el programa.', required: true },
  { code: '4', name: 'Análisis de evidencias por subcriterio', description: 'Análisis de la evidencia disponible para cada subcriterio del Criterio 9.', required: true },
  { code: '5', name: 'Fortalezas y debilidades', description: 'Síntesis de fortalezas y debilidades detectadas en el proceso.', required: true },
  { code: '6', name: 'Plan de mejora', description: 'Acciones correctivas, responsables y plazos asociados a las debilidades.', required: true },
  { code: '7', name: 'Anexos y evidencias documentales', description: 'Listado y enlaces a la evidencia documental de respaldo.', required: false },
];

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

  // 2) Criterio 9 + subcriterios
  const criterion = await prisma.criterion.upsert({
    where: { code: '9' },
    update: {
      name: 'Aseguramiento de la calidad de los programas formativos',
    },
    create: {
      code: '9',
      name: 'Aseguramiento de la calidad de los programas formativos',
      description:
        'Criterio 9 de la CNA: capacidad del programa de monitorear y mejorar sistemáticamente su calidad.',
    },
  });

  for (const sub of SUBCRITERIA) {
    await prisma.subcriterion.upsert({
      where: { criterionId_code: { criterionId: criterion.id, code: sub.code } },
      update: {
        name: sub.name,
        description: sub.description,
        keywords: sub.keywords,
        acceptedEvidenceTypes: sub.acceptedEvidenceTypes,
      },
      create: { ...sub, criterionId: criterion.id },
    });
  }
  console.log(`✓ Criterio 9 + ${SUBCRITERIA.length} subcriterios`);

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
