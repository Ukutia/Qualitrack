import { prisma } from '../config/prisma.js';
import { recordSecurityEvent } from '../services/audit.service.js';
import { config } from '../config/env.js';
import { viewFilter } from '../middleware/ownership.js';
import { toDisplayAnalysisStatus } from '../services/analysisStatus.service.js';
import {
  DocumentFilterValidationError,
  buildDocumentWhere,
  matchesDocumentName,
  normalizeForDocumentSearch,
  parseDocumentFilters,
} from '../services/documentFilters.service.js';
import {
  FolderValidationError,
  MAX_FOLDER_DEPTH,
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
  nullableId,
  selectedRootFolderIds,
  subtreeHeight,
  uniquePositiveIds,
} from '../services/folders.service.js';

const isAdmin = (user) => user.role === 'admin';
const canManageFolder = (user, folder) => isAdmin(user) || folder.createdById === user.id;
const ANALYSIS_IN_PROGRESS = new Set([
  'PREPARING_ANALYSIS', 'SENT_TO_ANALYZER', 'RECEIVED_BY_ANALYZER',
  'EXTRACTING_CONTENT', 'ANALYZING_CONTENT', 'RECEIVING_RESULT',
]);

function badRequest(res, error) {
  if (error instanceof FolderValidationError || error instanceof DocumentFilterValidationError) {
    return res.status(400).json({ code: error.code || 'INVALID_FILTER', error: error.message });
  }
  throw error;
}

async function allFolders(client = prisma) {
  return client.folder.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

function documentPayload(document, byId) {
  const validated = document.associations.find((association) => association.status === 'VALIDATED');
  const proposed = document.associations.find((association) => association.status === 'PROPOSED');
  let associationStatus = 'Sin clasificar';
  if (validated) associationStatus = 'Validada';
  else if (proposed) associationStatus = 'Propuesta';
  else if (document.associations.length) associationStatus = 'Descartada';

  return {
    id: document.id,
    name: document.originalName,
    format: document.format,
    sizeBytes: document.sizeBytes,
    source: document.source,
    documentDate: document.documentDate,
    uploadedAt: document.uploadedAt,
    uploadedBy: document.externalUploaderEmail || document.uploadedBy?.name,
    uploadedById: document.uploadedById,
    associationStatus,
    subcriterion: validated?.subcriterion?.code || proposed?.subcriterion?.code || null,
    vectorizationStatus: config.embeddings.enabled ? document.vectorizationStatus : 'DISABLED',
    analysisStatus: toDisplayAnalysisStatus(document.analysisStatus),
    analysisError: document.analysisError ?? null,
    folderId: document.folderId,
    folderPath: folderPath(document.folderId, byId),
  };
}

const documentInclude = {
  associations: { include: { subcriterion: true } },
  uploadedBy: { select: { name: true } },
};

export async function exploreFolders(req, res) {
  let parentId;
  let filters;
  try {
    parentId = nullableId(req.query.parentId, 'Carpeta');
    filters = parseDocumentFilters(req.query);
  } catch (error) {
    return badRequest(res, error);
  }

  const folders = await allFolders();
  const { byId, children } = folderMaps(folders);
  const current = parentId == null ? null : byId.get(parentId);
  if (parentId != null && !current) return res.status(404).json({ error: 'Carpeta no encontrada.' });

  const hasCriteria = Boolean(
    filters.text || filters.sources.length || filters.uploaders.length ||
    filters.subcriterionIds.length || filters.associationStatuses.length
  );
  const scopeFolderIds = parentId == null
    ? folders.map((folder) => folder.id)
    : [parentId, ...descendantIds(parentId, children)];
  const baseWhere = buildDocumentWhere(filters, viewFilter(req.user));

  if (!hasCriteria) {
    baseWhere.folderId = parentId;
  } else if (parentId != null) {
    baseWhere.folderId = { in: scopeFolderIds };
  }

  const queriedDocuments = await prisma.document.findMany({
    where: baseWhere,
    orderBy: { uploadedAt: 'desc' },
    include: documentInclude,
  });
  const matchingDocuments = queriedDocuments.filter((document) =>
    matchesDocumentName(document, filters.text)
  );

  const directFolders = children.get(parentId) || [];
  const directFolderIds = directFolders.map((folder) => folder.id);
  const previews = directFolderIds.length ? await prisma.document.findMany({
    where: { deletedAt: null, folderId: { in: directFolderIds }, ...viewFilter(req.user) },
    orderBy: { uploadedAt: 'desc' },
    select: { id: true, originalName: true, format: true, folderId: true },
  }) : [];
  const previewByFolder = new Map();
  for (const document of previews) {
    if (!previewByFolder.has(document.folderId)) previewByFolder.set(document.folderId, []);
    previewByFolder.get(document.folderId).push(document);
  }

  const folderResults = directFolders.map((folder) => {
    const ownMatch = filters.text && normalizeForDocumentSearch(folder.name)
      .includes(normalizeForDocumentSearch(filters.text));
    const descendantMatch = hasCriteria && matchingDocuments.some((document) =>
      firstChildUnder(document.folderId, parentId, byId)?.id === folder.id
    );
    const directDocuments = previewByFolder.get(folder.id) || [];
    return {
      id: folder.id,
      name: folder.name,
      color: folder.color,
      parentId: folder.parentId,
      createdAt: folder.createdAt,
      createdBy: folder.createdBy,
      canManage: canManageFolder(req.user, folder),
      directDocumentCount: directDocuments.length,
      preview: directDocuments.slice(0, 4).map((document) => ({
        id: document.id,
        name: document.originalName,
        format: document.format,
      })),
      match: ownMatch ? 'direct' : descendantMatch ? 'descendant' : null,
    };
  }).filter((folder) => !hasCriteria || folder.match);

  return res.json({
    currentFolder: current ? {
      id: current.id,
      name: current.name,
      color: current.color,
      parentId: current.parentId,
      canManage: canManageFolder(req.user, current),
    } : null,
    breadcrumbs: breadcrumbFor(parentId, byId),
    folders: folderResults,
    documents: matchingDocuments.map((document) => documentPayload(document, byId)),
  });
}

export async function createFolder(req, res) {
  let name;
  let color;
  let parentId;
  const documentIds = uniquePositiveIds(req.body?.documentIds);
  try {
    name = normalizedFolderName(req.body?.name);
    color = normalizedFolderColor(req.body?.color);
    parentId = nullableId(req.body?.parentId, 'Carpeta padre');
  } catch (error) {
    return badRequest(res, error);
  }
  if (!documentIds.length) {
    return res.status(400).json({ error: 'Debe seleccionar al menos un archivo para crear la carpeta.' });
  }

  const folders = await allFolders();
  const { byId } = folderMaps(folders);
  const parent = parentId == null ? null : byId.get(parentId);
  if (parentId != null && !parent) return res.status(404).json({ error: 'Carpeta padre no encontrada.' });
  if (parent && !canManageFolder(req.user, parent)) {
    return res.status(403).json({ code: 'FORBIDDEN_FOLDER', error: 'Solo el creador o un administrador puede crear subcarpetas aquí.' });
  }
  if (folderDepth(parentId, byId) + 1 > MAX_FOLDER_DEPTH) {
    return res.status(409).json({ code: 'MAX_FOLDER_DEPTH', error: 'La carpeta superaría el máximo de 10 niveles.' });
  }
  const sameName = await prisma.folder.findFirst({
    where: { parentId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (sameName) {
    return res.status(409).json({ code: 'DUPLICATE_FOLDER_NAME', error: 'Ya existe una carpeta con ese nombre en esta ubicación.' });
  }

  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds }, deletedAt: null },
  });
  if (documents.length !== documentIds.length) {
    return res.status(409).json({ error: 'Uno o más documentos ya no están activos.' });
  }
  if (documents.some((document) => document.folderId !== parentId)) {
    return res.status(409).json({ error: 'Solo puede agrupar documentos ubicados directamente en la carpeta actual.' });
  }
  if (!isAdmin(req.user) && documents.some((document) => document.uploadedById !== req.user.id)) {
    return res.status(403).json({ code: 'FORBIDDEN_DOCUMENTS', error: 'No puede crear una carpeta con documentos cargados por otras personas.' });
  }
  const duplicates = duplicateNames(documents);
  if (duplicates.length) {
    return res.status(409).json({ code: 'DUPLICATE_DOCUMENT_NAMES', error: 'La selección contiene documentos con el mismo nombre.', documents: duplicates });
  }

  try {
    const folder = await prisma.$transaction(async (tx) => {
      const created = await tx.folder.create({
        data: { name, color, parentId, createdById: req.user.id },
      });
      await tx.document.updateMany({
        where: { id: { in: documentIds } },
        data: { folderId: created.id },
      });
      return created;
    });
    return res.status(201).json(folder);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ code: 'DUPLICATE_FOLDER_NAME', error: 'Ya existe una carpeta con ese nombre en esta ubicación.' });
    }
    throw error;
  }
}

export async function updateFolder(req, res) {
  const id = Number(req.params.id);
  let name;
  try {
    name = normalizedFolderName(req.body?.name);
  } catch (error) {
    return badRequest(res, error);
  }
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder) return res.status(404).json({ error: 'Carpeta no encontrada.' });
  if (!canManageFolder(req.user, folder)) {
    return res.status(403).json({ code: 'FORBIDDEN_FOLDER', error: 'Solo el creador o un administrador puede renombrar esta carpeta.' });
  }
  const sameName = await prisma.folder.findFirst({
    where: { id: { not: id }, parentId: folder.parentId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (sameName) {
    return res.status(409).json({ code: 'DUPLICATE_FOLDER_NAME', error: 'Ya existe una carpeta con ese nombre en esta ubicación.' });
  }
  try {
    return res.json(await prisma.folder.update({ where: { id }, data: { name } }));
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ code: 'DUPLICATE_FOLDER_NAME', error: 'Ya existe una carpeta con ese nombre en esta ubicación.' });
    }
    throw error;
  }
}

async function folderWouldBecomeEmpty(folderId, excludedDocumentIds = [], excludedChildId = null) {
  if (folderId == null) return null;
  const [documents, children] = await Promise.all([
    prisma.document.count({ where: { folderId, deletedAt: null, id: { notIn: excludedDocumentIds } } }),
    prisma.folder.count({ where: { parentId: folderId, ...(excludedChildId ? { id: { not: excludedChildId } } : {}) } }),
  ]);
  return documents === 0 && children === 0
    ? prisma.folder.findUnique({ where: { id: folderId }, select: { id: true, name: true } })
    : null;
}

/**
 * Calcula las carpetas vacías que desaparecerían al quitar un documento.
 * La cadena puede subir varios niveles: si B era el único contenido de A y se
 * vacía B, tanto B como A deben eliminarse para no dejar agrupaciones vacías.
 */
export async function emptyFolderChainAfterDocumentRemoval(folderId, documentId) {
  if (folderId == null) return [];
  const [folders, documents] = await Promise.all([
    allFolders(),
    prisma.document.findMany({
      where: { deletedAt: null, folderId: { not: null }, id: { not: documentId } },
      select: { folderId: true },
    }),
  ]);
  const { byId, children } = folderMaps(folders);
  const documentCount = new Map();
  for (const document of documents) {
    documentCount.set(document.folderId, (documentCount.get(document.folderId) || 0) + 1);
  }

  const removedChildren = new Set();
  const result = [];
  let current = byId.get(folderId);
  while (current) {
    const remainingChildren = (children.get(current.id) || [])
      .filter((child) => !removedChildren.has(child.id));
    if ((documentCount.get(current.id) || 0) > 0 || remainingChildren.length > 0) break;
    result.push({ id: current.id, name: current.name });
    removedChildren.add(current.id);
    current = current.parentId == null ? null : byId.get(current.parentId);
  }
  return result;
}

export async function moveDocuments(req, res) {
  const documentIds = uniquePositiveIds(req.body?.documentIds);
  let sourceFolderId;
  let targetFolderId;
  try {
    sourceFolderId = nullableId(req.body?.sourceFolderId, 'Carpeta de origen');
    targetFolderId = nullableId(req.body?.targetFolderId, 'Carpeta de destino');
  } catch (error) {
    return badRequest(res, error);
  }
  if (!documentIds.length) return res.status(400).json({ error: 'Debe seleccionar al menos un documento.' });
  if (sourceFolderId === targetFolderId) return res.status(400).json({ error: 'El documento ya está en esa ubicación.' });

  const folders = await allFolders();
  const { byId } = folderMaps(folders);
  const source = sourceFolderId == null ? null : byId.get(sourceFolderId);
  const target = targetFolderId == null ? null : byId.get(targetFolderId);
  if (sourceFolderId != null && !source) return res.status(404).json({ error: 'Carpeta de origen no encontrada.' });
  if (targetFolderId != null && !target) return res.status(404).json({ error: 'Carpeta de destino no encontrada.' });
  const movingUp = source && targetFolderId === source.parentId;
  const movingDown = target && target.parentId === sourceFolderId;
  if (!movingUp && !movingDown) {
    return res.status(409).json({ code: 'INVALID_MOVE', error: 'Solo puede mover documentos al nivel superior o a una subcarpeta directa.' });
  }

  const documents = await prisma.document.findMany({ where: { id: { in: documentIds }, deletedAt: null } });
  if (documents.length !== documentIds.length || documents.some((document) => document.folderId !== sourceFolderId)) {
    return res.status(409).json({ error: 'Uno o más documentos ya no están en la ubicación indicada.' });
  }
  if (!isAdmin(req.user) && documents.some((document) => document.uploadedById !== req.user.id)) {
    return res.status(403).json({ code: 'FORBIDDEN_DOCUMENTS', error: 'Solo puede mover documentos cargados por usted.' });
  }

  const existing = await prisma.document.findMany({
    where: { folderId: targetFolderId, deletedAt: null, id: { notIn: documentIds } },
    select: { originalName: true },
  });
  const used = new Set(existing.map((document) => document.originalName.toLocaleLowerCase('es-CL')));
  const conflict = documents.find((document) => used.has(document.originalName.toLocaleLowerCase('es-CL')));
  if (conflict) {
    return res.status(409).json({ code: 'DUPLICATE_DOCUMENT_NAME', error: `Ya existe "${conflict.originalName}" en la ubicación de destino.` });
  }

  const emptyFolder = movingUp
    ? await folderWouldBecomeEmpty(sourceFolderId, documentIds)
    : null;
  if (emptyFolder && !req.body?.confirmEmptyFolder) {
    return res.status(409).json({
      code: 'FOLDER_WILL_BE_DELETED',
      error: `La carpeta "${emptyFolder.name}" quedará vacía y se eliminará.`,
      folder: emptyFolder,
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.document.updateMany({ where: { id: { in: documentIds } }, data: { folderId: targetFolderId } });
      if (emptyFolder) await tx.folder.delete({ where: { id: emptyFolder.id } });
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ code: 'DUPLICATE_DOCUMENT_NAME', error: 'Ya existe un documento con ese nombre en la ubicación de destino.' });
    }
    throw error;
  }
  return res.json({ moved: documentIds.length, deletedEmptyFolder: emptyFolder });
}

export async function moveFolder(req, res) {
  const id = Number(req.params.id);
  let targetParentId;
  try {
    targetParentId = nullableId(req.body?.targetParentId, 'Carpeta de destino');
  } catch (error) {
    return badRequest(res, error);
  }
  const folders = await allFolders();
  const { byId, children } = folderMaps(folders);
  const folder = byId.get(id);
  const target = targetParentId == null ? null : byId.get(targetParentId);
  if (!folder) return res.status(404).json({ error: 'Carpeta no encontrada.' });
  if (targetParentId != null && !target) return res.status(404).json({ error: 'Carpeta de destino no encontrada.' });
  if (!canManageFolder(req.user, folder)) {
    return res.status(403).json({ code: 'FORBIDDEN_FOLDER', error: 'Solo el creador o un administrador puede mover esta carpeta.' });
  }
  if (target && !canManageFolder(req.user, target)) {
    return res.status(403).json({ code: 'FORBIDDEN_FOLDER', error: 'No puede mover una carpeta dentro de una carpeta creada por otra persona.' });
  }
  const currentParent = folder.parentId == null ? null : byId.get(folder.parentId);
  const movingUp = currentParent && targetParentId === currentParent.parentId;
  const movingDown = target && target.parentId === folder.parentId && target.id !== folder.id;
  if (!movingUp && !movingDown) {
    return res.status(409).json({ code: 'INVALID_MOVE', error: 'Solo puede mover la carpeta al nivel superior o dentro de una carpeta hermana.' });
  }
  const descendants = new Set(descendantIds(id, children));
  if (targetParentId === id || descendants.has(targetParentId)) {
    return res.status(409).json({ code: 'FOLDER_CYCLE', error: 'No puede mover una carpeta dentro de sí misma o de sus descendientes.' });
  }
  const destinationDepth = folderDepth(targetParentId, byId);
  if (destinationDepth + subtreeHeight(id, children) > MAX_FOLDER_DEPTH) {
    return res.status(409).json({ code: 'MAX_FOLDER_DEPTH', error: 'El movimiento superaría el máximo de 10 niveles.' });
  }
  const sameName = await prisma.folder.findFirst({
    where: { id: { not: id }, parentId: targetParentId, name: { equals: folder.name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (sameName) {
    return res.status(409).json({ code: 'DUPLICATE_FOLDER_NAME', error: 'Ya existe una carpeta con ese nombre en el destino.' });
  }
  const emptyParent = movingUp
    ? await folderWouldBecomeEmpty(folder.parentId, [], folder.id)
    : null;
  if (emptyParent && !req.body?.confirmEmptyFolder) {
    return res.status(409).json({
      code: 'FOLDER_WILL_BE_DELETED',
      error: `La carpeta "${emptyParent.name}" quedará vacía y se eliminará.`,
      folder: emptyParent,
    });
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.folder.update({ where: { id }, data: { parentId: targetParentId } });
      if (emptyParent) await tx.folder.delete({ where: { id: emptyParent.id } });
    });
    return res.json({ id, parentId: targetParentId, deletedEmptyFolder: emptyParent });
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ code: 'DUPLICATE_FOLDER_NAME', error: 'Ya existe una carpeta con ese nombre en el destino.' });
    }
    throw error;
  }
}

export async function deleteFolder(req, res) {
  const id = Number(req.params.id);
  const mode = req.query.mode;
  if (!['keep', 'trash'].includes(mode)) {
    return res.status(400).json({ error: 'Debe elegir si conserva o envía los documentos a la papelera.' });
  }
  const folders = await allFolders();
  const { byId, children } = folderMaps(folders);
  const folder = byId.get(id);
  if (!folder) return res.status(404).json({ error: 'Carpeta no encontrada.' });
  const treeIds = [id, ...descendantIds(id, children)];
  const treeFolders = treeIds.map((folderId) => byId.get(folderId));
  if (!isAdmin(req.user) && treeFolders.some((item) => item.createdById !== req.user.id)) {
    return res.status(403).json({
      code: 'FORBIDDEN_FOLDER_TREE',
      error: 'La estructura contiene carpetas creadas por otra persona. Solo un administrador puede eliminarla.',
    });
  }
  const documents = await prisma.document.findMany({
    where: { folderId: { in: treeIds }, deletedAt: null },
    orderBy: { uploadedAt: 'asc' },
  });

  if (!isAdmin(req.user) && documents.some((document) => document.uploadedById !== req.user.id)) {
    return res.status(403).json({
      code: 'FORBIDDEN_DOCUMENTS',
      error: 'La carpeta contiene documentos cargados por otra persona. Solo un administrador puede eliminar la agrupación.',
    });
  }

  if (mode === 'trash') {
    const processing = documents.filter((document) =>
      (config.embeddings.enabled && document.vectorizationStatus === 'PROCESSING') ||
      ANALYSIS_IN_PROGRESS.has(String(document.analysisStatus || '').toUpperCase())
    );
    if (processing.length) {
      return res.status(409).json({
        code: 'DOCUMENTS_PROCESSING',
        error: 'No se puede eliminar la carpeta mientras haya documentos en proceso.',
        documents: processing.map((document) => ({ id: document.id, name: document.originalName })),
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.document.updateMany({
        where: { id: { in: documents.map((document) => document.id) } },
        data: { deletedAt: new Date(), folderId: null },
      });
      await tx.folder.delete({ where: { id } });
      for (const document of documents) {
        await recordSecurityEvent({ user: req.user, action: 'DOCUMENTS_TRASH_POST', resourceType: 'documents', resourceId: document.id }, tx);
      }
      await recordSecurityEvent({ user: req.user, action: 'FOLDERS_DELETE', resourceType: 'folders', resourceId: id }, tx);
    });
    req.auditRecorded = true;
    return res.json({ deletedFolderId: id, trashedDocuments: documents.length });
  }

  const destinationDocuments = await prisma.document.findMany({
    where: { folderId: folder.parentId, deletedAt: null, id: { notIn: documents.map((document) => document.id) } },
    select: { originalName: true },
  });
  const usedNames = new Set(destinationDocuments.map((document) =>
    document.originalName.toLocaleLowerCase('es-CL')
  ));
  const moves = documents.map((document) => ({
    id: document.id,
    name: nextAvailableDocumentName(document.originalName, usedNames),
  }));
  await prisma.$transaction(async (tx) => {
    for (const move of moves) {
      await tx.document.update({
        where: { id: move.id },
        data: { folderId: folder.parentId, originalName: move.name },
      });
    }
    await tx.folder.delete({ where: { id } });
  });
  return res.json({
    deletedFolderId: id,
    preservedDocuments: moves.length,
    renamedDocuments: moves.filter((move) => {
      const original = documents.find((document) => document.id === move.id);
      return original.originalName !== move.name;
    }),
  });
}

export async function bulkTrashItems(req, res) {
  const folderIds = uniquePositiveIds(req.body?.folderIds);
  const documentIds = uniquePositiveIds(req.body?.documentIds);
  if (!folderIds.length && !documentIds.length) {
    return res.status(400).json({ error: 'Debe seleccionar al menos una carpeta o un documento.' });
  }

  const folders = await allFolders();
  const { byId, children } = folderMaps(folders);
  const missingFolderIds = folderIds.filter((id) => !byId.has(id));
  if (missingFolderIds.length) {
    return res.status(404).json({ error: 'Una o más carpetas seleccionadas ya no existen.' });
  }

  const rootFolderIds = selectedRootFolderIds(folderIds, byId);
  const treeFolderIds = new Set();
  for (const rootId of rootFolderIds) {
    treeFolderIds.add(rootId);
    for (const descendantId of descendantIds(rootId, children)) treeFolderIds.add(descendantId);
  }
  const treeFolders = [...treeFolderIds].map((id) => byId.get(id));
  if (!isAdmin(req.user) && treeFolders.some((folder) => folder.createdById !== req.user.id)) {
    return res.status(403).json({
      code: 'FORBIDDEN_FOLDER_TREE',
      error: 'La selección contiene carpetas creadas por otra persona. Solo un administrador puede eliminarlas.',
    });
  }

  const conditions = [];
  if (documentIds.length) conditions.push({ id: { in: documentIds } });
  if (treeFolderIds.size) conditions.push({ folderId: { in: [...treeFolderIds] } });
  const documents = await prisma.document.findMany({
    where: { deletedAt: null, OR: conditions },
    orderBy: { uploadedAt: 'asc' },
  });
  const foundIds = new Set(documents.map((document) => document.id));
  if (documentIds.some((id) => !foundIds.has(id))) {
    return res.status(409).json({ error: 'Uno o más documentos seleccionados ya no están activos.' });
  }
  if (!isAdmin(req.user) && documents.some((document) => document.uploadedById !== req.user.id)) {
    return res.status(403).json({
      code: 'FORBIDDEN_DOCUMENTS',
      error: 'La selección contiene documentos cargados por otra persona. Solo un administrador puede eliminarlos.',
    });
  }

  const processing = documents.filter((document) =>
    (config.embeddings.enabled && document.vectorizationStatus === 'PROCESSING') ||
    ANALYSIS_IN_PROGRESS.has(String(document.analysisStatus || '').toUpperCase())
  );
  if (processing.length) {
    return res.status(409).json({
      code: 'DOCUMENTS_PROCESSING',
      error: 'No se puede completar la eliminación mientras haya documentos en proceso.',
      documents: processing.map((document) => ({ id: document.id, name: document.originalName })),
    });
  }

  const idsToTrash = [...new Set(documents.map((document) => document.id))];
  await prisma.$transaction(async (tx) => {
    if (idsToTrash.length) {
      await tx.document.updateMany({
        where: { id: { in: idsToTrash } },
        data: { deletedAt: new Date(), folderId: null },
      });
    }
    if (rootFolderIds.length) {
      await tx.folder.deleteMany({ where: { id: { in: rootFolderIds } } });
    }
    for (const documentId of idsToTrash) {
      await recordSecurityEvent({ user: req.user, action: 'DOCUMENTS_TRASH_POST', resourceType: 'documents', resourceId: documentId }, tx);
    }
    for (const folderId of treeFolderIds) {
      await recordSecurityEvent({ user: req.user, action: 'FOLDERS_DELETE', resourceType: 'folders', resourceId: folderId }, tx);
    }
  });
  req.auditRecorded = true;

  return res.json({
    trashedDocuments: idsToTrash.length,
    deletedFolders: treeFolderIds.size,
  });
}

export async function emptyFolderAfterDocumentRemoval(folderId, documentId) {
  return folderWouldBecomeEmpty(folderId, [documentId]);
}
