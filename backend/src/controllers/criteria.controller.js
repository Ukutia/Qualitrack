// HU03 — Estructura oficial del informe CNA (ver / versionar) y consulta del criterio.
import { prisma } from '../config/prisma.js';

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
      data: { version: nextVersion, active: true },
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
