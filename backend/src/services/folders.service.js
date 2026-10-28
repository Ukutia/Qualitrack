import path from 'path';

export const FOLDER_COLORS = new Set([
  'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink', 'gray',
]);
export const MAX_FOLDER_DEPTH = 10;

export class FolderValidationError extends Error {
  constructor(message, code = 'INVALID_FOLDER') {
    super(message);
    this.code = code;
  }
}

export function normalizedFolderName(value) {
  if (typeof value !== 'string') {
    throw new FolderValidationError('El nombre de la carpeta es obligatorio.');
  }
  const name = value.trim();
  if (!name) throw new FolderValidationError('El nombre de la carpeta es obligatorio.');
  if (name.length > 100) {
    throw new FolderValidationError('El nombre de la carpeta no puede superar los 100 caracteres.');
  }
  return name;
}

export function normalizedFolderColor(value) {
  if (!FOLDER_COLORS.has(value)) {
    throw new FolderValidationError('El color de la carpeta no es válido.');
  }
  return value;
}

export function nullableId(value, label = 'Identificador') {
  if (value === null || value === undefined || value === '' || value === 'root') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new FolderValidationError(`${label} inválido.`);
  }
  return id;
}

export function uniquePositiveIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

export function folderMaps(folders) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const children = new Map();
  for (const folder of folders) {
    const key = folder.parentId ?? null;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(folder);
  }
  return { byId, children };
}

export function descendantIds(folderId, children) {
  const result = [];
  const queue = [...(children.get(folderId) || [])];
  while (queue.length) {
    const folder = queue.shift();
    result.push(folder.id);
    queue.push(...(children.get(folder.id) || []));
  }
  return result;
}

export function selectedRootFolderIds(folderIds, byId) {
  const selected = new Set(folderIds);
  return folderIds.filter((folderId) => {
    let current = byId.get(folderId);
    while (current?.parentId != null) {
      if (selected.has(current.parentId)) return false;
      current = byId.get(current.parentId);
    }
    return true;
  });
}

export function folderDepth(folderId, byId) {
  let depth = 0;
  let current = folderId == null ? null : byId.get(folderId);
  const visited = new Set();
  while (current) {
    if (visited.has(current.id)) throw new FolderValidationError('La estructura de carpetas contiene un ciclo.');
    visited.add(current.id);
    depth += 1;
    current = current.parentId == null ? null : byId.get(current.parentId);
  }
  return depth;
}

export function subtreeHeight(folderId, children) {
  const direct = children.get(folderId) || [];
  if (!direct.length) return 1;
  return 1 + Math.max(...direct.map((folder) => subtreeHeight(folder.id, children)));
}

export function folderPath(folderId, byId) {
  const names = [];
  let current = folderId == null ? null : byId.get(folderId);
  const visited = new Set();
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId == null ? null : byId.get(current.parentId);
  }
  return names.length ? `/${names.join('/')}` : null;
}

export function breadcrumbFor(folderId, byId) {
  const result = [];
  let current = folderId == null ? null : byId.get(folderId);
  const visited = new Set();
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    result.unshift({ id: current.id, name: current.name });
    current = current.parentId == null ? null : byId.get(current.parentId);
  }
  return result;
}

export function firstChildUnder(documentFolderId, currentFolderId, byId) {
  let current = documentFolderId == null ? null : byId.get(documentFolderId);
  let candidate = null;
  while (current && current.id !== currentFolderId) {
    candidate = current;
    current = current.parentId == null ? null : byId.get(current.parentId);
  }
  if (currentFolderId == null) {
    while (candidate?.parentId != null) candidate = byId.get(candidate.parentId);
  }
  return current?.id === currentFolderId || currentFolderId == null ? candidate : null;
}

export function nextAvailableDocumentName(originalName, usedLowercaseNames) {
  let candidate = originalName;
  let counter = 1;
  const extension = path.extname(originalName);
  const base = extension ? originalName.slice(0, -extension.length) : originalName;
  while (usedLowercaseNames.has(candidate.toLocaleLowerCase('es-CL'))) {
    candidate = `${base} (${counter})${extension}`;
    counter += 1;
  }
  usedLowercaseNames.add(candidate.toLocaleLowerCase('es-CL'));
  return candidate;
}

export function duplicateNames(documents) {
  const seen = new Set();
  const duplicates = new Set();
  for (const document of documents) {
    const key = document.originalName.toLocaleLowerCase('es-CL');
    if (seen.has(key)) duplicates.add(document.originalName);
    seen.add(key);
  }
  return [...duplicates];
}
