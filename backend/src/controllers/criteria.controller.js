// HU03 — Estructura oficial del informe CNA (ver / versionar) y consulta del criterio.
import { prisma } from '../config/prisma.js';
import { extractText } from '../services/textExtraction.service.js';
import { parseStructureSections } from '../services/structureParser.service.js';
import { formatFromName } from '../middleware/upload.js';

const CRITERION_CODE = '9';

/** GET /criteria — Criterio 9 con sus subcriterios. */
export async function getCriterion(req, res) {
  const criterion = await prisma.criterion.findUnique({
    where: { code: CRITERION_CODE },
    include: { subcriteria: { orderBy: { code: 'asc' } } },
  });
  if (!criterion) return res.status(404).json({ error: 'Criterio no configurado.' });
  return res.json(criterion);
}

/** GET /report-structure — secciones de la versión activa. */
export async function getReportStructure(req, res) {
  const version = await prisma.reportStructureVersion.findFirst({
    where: { active: true },
    include: { sections: { orderBy: { order: 'asc' } } },
  });
  if (!version) return res.json({ version: null, sections: [] });

  return res.json({
    version: version.version,
    uploadedAt: version.uploadedAt,
    sections: version.sections.map((s) => ({
      code: s.code,
      name: s.name,
      description: s.description,
      label: s.required ? 'Obligatoria' : 'Opcional',
      required: s.required,
      changeType: s.changeType,
    })),
  });
}

/**
 * POST /report-structure/parse — recibe un archivo PDF/DOC/DOCX y devuelve
 * las secciones detectadas sin guardarlas en la base de datos.
 * Multipart: campo "file".
 */
export async function parseStructureDocument(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Se requiere un archivo PDF, DOC o DOCX.' });
  }

  const format = formatFromName(req.file.originalname);
  if (!format || format === 'xlsx') {
    return res.status(400).json({ error: 'Solo se aceptan archivos PDF, DOC o DOCX.' });
  }

  const text = await extractText(req.file.buffer, format);
  if (!text || text.trim().length === 0) {
    return res.status(422).json({
      error: 'No se pudo extraer texto del documento. Verifique que el archivo no esté protegido o dañado.',
    });
  }

  const sections = parseStructureSections(text);
  if (sections.length === 0) {
    return res.status(422).json({
      error:
        'No se encontraron secciones numeradas en el documento. ' +
        'Asegúrese de que el documento utilice numeración decimal (ej. 1., 1.1., 2.3.).',
    });
  }

  return res.json({
    filename: req.file.originalname,
    totalSections: sections.length,
    sections,
  });
}

/**
 * POST /report-structure — sube una nueva versión de la plantilla (JSON).
 * Body: { sections: [{ code, name, description?, required? }] }
 * Marca ADDED / REMOVED / RENAMED respecto de la versión activa anterior.
 */
export async function uploadReportStructure(req, res) {
  const { sections } = req.body || {};
  if (!Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({
      error: 'Debe enviar "sections": un arreglo con al menos una sección { code, name }.',
    });
  }
  for (const s of sections) {
    if (!s.code || !s.name) {
      return res.status(400).json({ error: 'Cada sección requiere "code" y "name".' });
    }
  }

  const prev = await prisma.reportStructureVersion.findFirst({
    where: { active: true },
    include: { sections: true },
  });
  const prevByCode = new Map((prev?.sections || []).map((s) => [s.code, s]));
  const newCodes = new Set(sections.map((s) => s.code));

  const lastVersion = await prisma.reportStructureVersion.findFirst({
    orderBy: { version: 'desc' },
  });
  const nextVersion = (lastVersion?.version || 0) + 1;

  // Calcula el changeType de cada sección nueva.
  const toCreate = sections.map((s, i) => {
    const old = prevByCode.get(s.code);
    let changeType = 'NONE';
    if (!old) changeType = 'ADDED';
    else if (old.name !== s.name) changeType = 'RENAMED';
    return {
      code: s.code,
      name: s.name,
      description: s.description ?? null,
      required: s.required ?? true,
      order: i,
      changeType,
    };
  });

  // Secciones eliminadas: estaban antes y ya no están. NO se persisten (la
  // estructura nueva solo contiene las secciones vigentes); solo se reportan
  // en el resumen de cambios para que el usuario sepa qué desapareció.
  const removed = (prev?.sections || [])
    .filter((s) => !newCodes.has(s.code))
    .map((s) => ({ code: s.code, name: s.name, changeType: 'REMOVED' }));

  const created = await prisma.$transaction(async (tx) => {
    if (prev) await tx.reportStructureVersion.update({ where: { id: prev.id }, data: { active: false } });
    const version = await tx.reportStructureVersion.create({
      data: { version: nextVersion, active: true, uploadedById: req.user?.id ?? null },
    });
    await tx.reportSection.createMany({
      data: toCreate.map((s) => ({ ...s, versionId: version.id })),
    });
    return version;
  });

  const changes = [...toCreate, ...removed]
    .filter((s) => s.changeType !== 'NONE')
    .map((s) => ({ code: s.code, name: s.name, changeType: s.changeType }));

  return res.status(201).json({
    version: created.version,
    sectionsDetected: toCreate.length,
    changes,
    message: `Estructura actualizada a la versión ${created.version}. ` +
      `Se detectaron ${toCreate.length} secciones y ${changes.length} cambio(s).`,
  });
}

/** GET /report-structure/history — todas las versiones, de más reciente a más antigua. */
export async function getStructureHistory(req, res) {
  const versions = await prisma.reportStructureVersion.findMany({
    orderBy: { version: 'desc' },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      sections: { select: { id: true } },
    },
  });

  return res.json(
    versions.map((v) => ({
      version: v.version,
      uploadedAt: v.uploadedAt,
      active: v.active,
      note: v.note,
      sectionCount: v.sections.length,
      uploadedBy: v.uploadedBy
        ? { id: v.uploadedBy.id, name: v.uploadedBy.name, email: v.uploadedBy.email }
        : null,
    }))
  );
}

/**
 * POST /report-structure/:version/restore
 * Crea una nueva versión copiando todas las secciones de la versión indicada.
 */
export async function restoreStructureVersion(req, res) {
  const targetVersion = parseInt(req.params.version, 10);
  if (Number.isNaN(targetVersion)) {
    return res.status(400).json({ error: 'Versión inválida.' });
  }

  const target = await prisma.reportStructureVersion.findUnique({
    where: { version: targetVersion },
    include: { sections: { orderBy: { order: 'asc' } } },
  });
  if (!target) {
    return res.status(404).json({ error: `Versión ${targetVersion} no encontrada.` });
  }
  if (target.active) {
    return res.status(409).json({ error: 'Esta versión ya es la activa.' });
  }

  const prev = await prisma.reportStructureVersion.findFirst({ where: { active: true } });
  const lastVersion = await prisma.reportStructureVersion.findFirst({ orderBy: { version: 'desc' } });
  const nextVersion = (lastVersion?.version || 0) + 1;

  const created = await prisma.$transaction(async (tx) => {
    if (prev) await tx.reportStructureVersion.update({ where: { id: prev.id }, data: { active: false } });
    const version = await tx.reportStructureVersion.create({
      data: {
        version: nextVersion,
        active: true,
        note: `Restaurada desde versión ${targetVersion}`,
        uploadedById: req.user?.id ?? null,
      },
    });
    await tx.reportSection.createMany({
      data: target.sections.map((s) => ({
        code: s.code,
        name: s.name,
        description: s.description,
        required: s.required,
        order: s.order,
        changeType: 'NONE',
        versionId: version.id,
      })),
    });
    return version;
  });

  return res.status(201).json({
    version: created.version,
    restoredFrom: targetVersion,
    sectionCount: target.sections.length,
    message: `Versión ${created.version} creada restaurando la estructura de la versión ${targetVersion}.`,
  });
}
