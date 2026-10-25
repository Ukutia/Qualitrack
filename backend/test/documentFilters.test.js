import { describe, expect, it } from 'vitest';
import {
  DocumentFilterValidationError,
  buildDocumentWhere,
  matchesDocumentName,
  parseDocumentFilters,
} from '../src/services/documentFilters.service.js';

describe('filtros del repositorio de evidencias (HU21)', () => {
  it('encuentra coincidencias parciales sin distinguir mayúsculas ni tildes', () => {
    expect(matchesDocumentName({ originalName: 'Política Institucional.PDF' }, 'politica')).toBe(true);
    expect(matchesDocumentName({ originalName: 'Política Institucional.PDF' }, 'INSTITUCIONAL')).toBe(true);
    expect(matchesDocumentName({ originalName: 'Política Institucional.PDF' }, 'presupuesto')).toBe(false);
  });

  it('elimina valores repetidos al interpretar filtros multiselección', () => {
    expect(parseDocumentFilters({
      q: '  informe  ',
      sources: 'UPLOAD,GOOGLE_DRIVE,UPLOAD',
      uploaders: 'user:4,external:evaluador@example.com,user:4',
      subcriteria: '2,7,2',
      associationStatuses: 'VALIDATED,UNVALIDATED,VALIDATED',
    })).toEqual({
      text: 'informe',
      sources: ['UPLOAD', 'GOOGLE_DRIVE'],
      uploaders: [
        { type: 'user', value: 'user:4', id: 4 },
        {
          type: 'external',
          value: 'external:evaluador@example.com',
          email: 'evaluador@example.com',
        },
      ],
      subcriterionIds: [2, 7],
      associationStatuses: ['VALIDATED', 'UNVALIDATED'],
    });
  });

  it('combina categorías con AND y alternativas de una categoría con OR', () => {
    const filters = parseDocumentFilters({
      sources: 'UPLOAD,DROPBOX',
      uploaders: 'user:4,external:evaluador@example.com',
      subcriteria: '2,7',
      associationStatuses: 'UNVALIDATED',
    });

    expect(buildDocumentWhere(filters, { uploadedById: 99 })).toEqual({
      deletedAt: null,
      uploadedById: 99,
      source: { in: ['UPLOAD', 'DROPBOX'] },
      OR: [
        { uploadedById: 4, externalUploaderEmail: null },
        {
          externalUploaderEmail: {
            equals: 'evaluador@example.com',
            mode: 'insensitive',
          },
        },
      ],
      associations: {
        some: {
          subcriterionId: { in: [2, 7] },
          status: { in: ['PROPOSED', 'NOT_VALIDATED'] },
        },
      },
    });
  });

  it('interpreta validada y no validada como estados alternativos', () => {
    const filters = parseDocumentFilters({
      associationStatuses: 'VALIDATED,UNVALIDATED',
    });

    expect(buildDocumentWhere(filters).associations).toEqual({
      some: { status: { in: ['VALIDATED', 'PROPOSED', 'NOT_VALIDATED'] } },
    });
  });

  it('rechaza criterios manipulados en lugar de ampliar la consulta', () => {
    expect(() => parseDocumentFilters({ sources: 'INVENTADA' }))
      .toThrow(DocumentFilterValidationError);
    expect(() => parseDocumentFilters({ uploaders: 'user:0' }))
      .toThrow(DocumentFilterValidationError);
    expect(() => parseDocumentFilters({ subcriteria: '2,no-numérico' }))
      .toThrow(DocumentFilterValidationError);
    expect(() => parseDocumentFilters({ associationStatuses: 'SIN_CLASIFICAR' }))
      .toThrow(DocumentFilterValidationError);
  });
});
