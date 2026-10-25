const DOCUMENT_SOURCES = new Set(['UPLOAD', 'GOOGLE_DRIVE', 'DROPBOX']);
const ASSOCIATION_FILTER_STATUSES = new Set(['VALIDATED', 'UNVALIDATED']);

export class DocumentFilterValidationError extends Error {}

function queryList(value) {
  if (value === undefined || value === null || value === '') return [];
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean))];
}

function invalidFilter(message) {
  throw new DocumentFilterValidationError(message);
}

export function normalizeForDocumentSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-CL');
}

export function parseDocumentFilters(query = {}) {
  const text = typeof query.q === 'string' ? query.q.trim() : '';
  if (text.length > 200) invalidFilter('El texto de búsqueda no puede superar los 200 caracteres.');

  const sources = queryList(query.sources);
  if (sources.some((source) => !DOCUMENT_SOURCES.has(source))) {
    invalidFilter('Se indicó una fuente de documento no válida.');
  }

  const uploaderValues = queryList(query.uploaders);
  const uploaders = uploaderValues.map((value) => {
    if (/^user:[1-9]\d*$/.test(value)) {
      return { type: 'user', value, id: Number(value.slice(5)) };
    }
    if (/^external:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)) {
      return { type: 'external', value, email: value.slice(9) };
    }
    invalidFilter('Se indicó un cargador no válido.');
  });

  const subcriterionValues = queryList(query.subcriteria);
  if (subcriterionValues.some((value) => !/^[1-9]\d*$/.test(value))) {
    invalidFilter('Se indicó un subcriterio no válido.');
  }
  const subcriterionIds = subcriterionValues.map(Number);

  const associationStatuses = queryList(query.associationStatuses);
  if (associationStatuses.some((status) => !ASSOCIATION_FILTER_STATUSES.has(status))) {
    invalidFilter('Se indicó un estado de asociación no válido.');
  }

  return { text, sources, uploaders, subcriterionIds, associationStatuses };
}

export function buildDocumentWhere(filters, visibility = {}) {
  const where = { deletedAt: null, ...visibility };

  if (filters.sources.length) where.source = { in: filters.sources };

  if (filters.uploaders.length) {
    where.OR = filters.uploaders.map((uploader) => uploader.type === 'external'
      ? { externalUploaderEmail: { equals: uploader.email, mode: 'insensitive' } }
      : { uploadedById: uploader.id, externalUploaderEmail: null });
  }

  if (filters.subcriterionIds.length || filters.associationStatuses.length) {
    const association = {};
    if (filters.subcriterionIds.length) {
      association.subcriterionId = { in: filters.subcriterionIds };
    }
    if (filters.associationStatuses.length) {
      const statuses = [];
      if (filters.associationStatuses.includes('VALIDATED')) statuses.push('VALIDATED');
      if (filters.associationStatuses.includes('UNVALIDATED')) {
        statuses.push('PROPOSED', 'NOT_VALIDATED');
      }
      association.status = { in: statuses };
    }
    where.associations = { some: association };
  }

  return where;
}

export function matchesDocumentName(document, text) {
  if (!text) return true;
  return normalizeForDocumentSearch(document.originalName).includes(
    normalizeForDocumentSearch(text)
  );
}
