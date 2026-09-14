// Subcriterios del Criterio 9, espejo de prisma/seed.js.
// Se usa cuando no hay base de datos disponible (tests y scripts).

export const SUBCRITERIA = [
  {
    id: 1,
    code: '9.1.1',
    name: 'Institucionalidad de la calidad',
    description:
      'Existe una política de aseguramiento interno de la calidad y responsables de su implementación, ' +
      'coherente con la misión y propósitos institucionales.',
    keywords: ['política de calidad', 'aseguramiento interno de la calidad', 'organigrama', 'decreto'],
  },
  {
    id: 2,
    code: '9.1.2',
    name: 'Monitoreo del desempeño',
    description:
      'La universidad recoge y procesa información sobre los resultados de su desempeño y la utiliza ' +
      'para identificar áreas a mejorar.',
    keywords: ['informe de gestión', 'indicadores institucionales', 'retención', 'deserción'],
  },
  {
    id: 3,
    code: '9.1.3',
    name: 'Transparencia y acceso a la información',
    description:
      'La información sobre el desempeño institucional es accesible para directivos, facultades y ' +
      'otras unidades organizativas.',
    keywords: ['transparencia', 'acceso a la información', 'Power BI', 'tablero de control'],
  },
  {
    id: 4,
    code: '9.2.1',
    name: 'Formalización de mecanismos e indicadores',
    description:
      'Existen mecanismos formalizados y sistemas de información que permiten gestionar internamente ' +
      'la calidad: manuales, reglamentos, KPI con alertas.',
    keywords: ['manual de procedimientos', 'rediseño curricular', 'KPI', 'cuadro de mando integral'],
  },
  {
    id: 5,
    code: '9.2.2',
    name: 'Instalación de una cultura de calidad transversal',
    description:
      'Se promueve una cultura de calidad con participación y responsabilidad de todos los estamentos.',
    keywords: ['cultura de calidad', 'participación', 'estamentos', 'capacitación'],
  },
  {
    id: 6,
    code: '9.3.1',
    name: 'Autorregulación autónoma y madurez del sistema',
    description:
      'El sistema garantiza autorregulación y mejoramiento continuo: planes de mejora cerrados, ' +
      'presupuesto ejecutado, auditorías externas al propio sistema.',
    keywords: ['autorregulación', 'plan de mejora cerrado', 'auditoría externa'],
  },
  {
    id: 7,
    code: '9.3.2',
    name: 'Compromiso y coherencia estamental total',
    description:
      'Cada estamento y persona evidencia compromiso con la cultura de calidad y puede explicar cómo ' +
      'su rol aporta a la calidad institucional.',
    keywords: ['compromiso estamental', 'pares evaluadores', 'socialización'],
  },
];
