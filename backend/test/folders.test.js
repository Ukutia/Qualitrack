import { describe, expect, it } from 'vitest';
import {
  FolderValidationError,
  breadcrumbFor,
  descendantIds,
  duplicateNames,
  firstChildUnder,
  folderDepth,
  folderMaps,
  folderPath,
  nextAvailableDocumentName,
  normalizedFolderColor,
  normalizedFolderName,
  selectedRootFolderIds,
  subtreeHeight,
} from '../src/services/folders.service.js';

const tree = [
  { id: 1, name: 'Carpeta A', parentId: null },
  { id: 2, name: 'Carpeta B', parentId: 1 },
  { id: 3, name: 'Carpeta C', parentId: 2 },
  { id: 4, name: 'Carpeta X', parentId: null },
];

describe('organización virtual de evidencias (HU26)', () => {
  it('calcula rutas, migas y límites del árbol sin mover archivos físicos', () => {
    const { byId, children } = folderMaps(tree);
    expect(folderPath(3, byId)).toBe('/Carpeta A/Carpeta B/Carpeta C');
    expect(breadcrumbFor(3, byId).map((folder) => folder.id)).toEqual([1, 2, 3]);
    expect(descendantIds(1, children)).toEqual([2, 3]);
    expect(folderDepth(3, byId)).toBe(3);
    expect(subtreeHeight(1, children)).toBe(3);
  });

  it('presenta solo el primer ancestro directo de un resultado descendiente', () => {
    const { byId } = folderMaps(tree);
    expect(firstChildUnder(3, null, byId)?.id).toBe(1);
    expect(firstChildUnder(3, 1, byId)?.id).toBe(2);
    expect(firstChildUnder(3, 2, byId)?.id).toBe(3);
    expect(firstChildUnder(4, 1, byId)).toBeNull();
  });

  it('reduce una selección anidada a sus carpetas raíz para eliminarla una sola vez', () => {
    const { byId } = folderMaps(tree);
    expect(selectedRootFolderIds([1, 2, 3, 4], byId)).toEqual([1, 4]);
    expect(selectedRootFolderIds([2, 3], byId)).toEqual([2]);
  });

  it('renombra choques conservando la extensión y sin distinguir mayúsculas', () => {
    const used = new Set(['informe.pdf', 'INFORME (1).PDF'].map((name) => name.toLocaleLowerCase('es-CL')));
    expect(nextAvailableDocumentName('Informe.pdf', used)).toBe('Informe (2).pdf');
    expect(nextAvailableDocumentName('Acta.docx', used)).toBe('Acta.docx');
  });

  it('detecta homónimos dentro de una misma selección sin confundir tildes', () => {
    expect(duplicateNames([
      { originalName: 'Informe.pdf' },
      { originalName: 'INFORME.PDF' },
      { originalName: 'Infórme.pdf' },
    ])).toEqual(['INFORME.PDF']);
  });

  it('valida nombre, largo y paleta cerrada', () => {
    expect(normalizedFolderName('  Auditoría  ')).toBe('Auditoría');
    expect(normalizedFolderColor('purple')).toBe('purple');
    expect(() => normalizedFolderName(' '.repeat(3))).toThrow(FolderValidationError);
    expect(() => normalizedFolderName('a'.repeat(101))).toThrow(FolderValidationError);
    expect(() => normalizedFolderColor('turquoise')).toThrow(FolderValidationError);
  });
});
