// Niveles del Criterio 9 CNA — "Gestión y resultados del aseguramiento interno
// de la calidad". Son acumulativos: el Nivel 2 exige todo el Nivel 1, y el
// Nivel 3 exige los dos anteriores.
export const LEVELS = {
  1: {
    label: 'Nivel 1',
    title: 'Cumplimiento obligatorio',
    short: 'Obligatorio',
    description:
      'Piso mínimo para acreditarse. Si falla uno solo de estos subcriterios, la universidad ' +
      'arriesga no acreditar o quedar con una acreditación muy baja.',
    accent: 'text-rose-600',
    chip: 'bg-rose-50 text-rose-700 ring-rose-200',
    bar: 'bg-rose-500',
  },
  2: {
    label: 'Nivel 2',
    title: 'Acreditación avanzada',
    short: 'Avanzado',
    description:
      'Requiere todo el Nivel 1. Se evalúa que el sistema sea formalizado y sistemático, ' +
      'no un esfuerzo de última hora.',
    accent: 'text-amber-600',
    chip: 'bg-amber-50 text-amber-700 ring-amber-200',
    bar: 'bg-amber-400',
  },
  3: {
    label: 'Nivel 3',
    title: 'Excelencia',
    short: 'Excelencia',
    description:
      'La calidad ya no es un control: es la forma natural en que la universidad opera en su día a día.',
    accent: 'text-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    bar: 'bg-emerald-500',
  },
};

export const LEVEL_ORDER = [1, 2, 3];

/** Metadatos del nivel, con respaldo al Nivel 1 si viniera vacío. */
export const levelMeta = (level) => LEVELS[level] || LEVELS[1];
