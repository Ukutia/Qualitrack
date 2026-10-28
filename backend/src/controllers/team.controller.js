// HU18 — El Encargado de Aseguramiento de la Calidad (admin) incorpora personas
// al equipo. El acceso se concede de inmediato con el rol elegido y se avisa por
// correo; la persona no acepta ni rechaza nada.
//
// La ruta no está mapeada en config/permissions.js, así que enforceRolePolicy
// la deniega con 403 a cualquier rol que no sea admin.
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { ROLES, ROLE_LABELS, isKnownRole } from '../config/roles.js';
import { MODULES, MODULE_LABELS, LEVELS, effectivePermissions, isKnownLevel, isKnownModule } from '../config/permissions.js';
import { invalidatePermissions } from '../middleware/authorize.js';
import { recordSecurityEvent } from '../services/audit.service.js';
import { sendTeamWelcomeEmail } from '../services/requestEmail.service.js';

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
// Letras Unicode (tildes, ñ, diéresis) separadas por un espacio.
const LETTERS_PATTERN = /^[\p{L}\p{M}]+( [\p{L}\p{M}]+)*$/u;
const MAX_TEXT = 100;

const MEMBER_FIELDS = { id: true, name: true, email: true, cargo: true, role: true, createdAt: true };

function cleanText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function validateLetters(value, label) {
  if (!value) return `El ${label} es obligatorio.`;
  if (value.length > MAX_TEXT) return `El ${label} no puede superar ${MAX_TEXT} caracteres.`;
  if (!LETTERS_PATTERN.test(value)) {
    return `El ${label} solo puede contener letras y espacios (sin números ni símbolos).`;
  }
  return null;
}

/**
 * Normaliza y valida los datos de incorporación. Devuelve los valores limpios y
 * un objeto de errores por campo (vacío si todo es válido).
 */
export function validateMemberInput(body = {}) {
  const email = cleanText(body.email).toLowerCase();
  const nombre = cleanText(body.nombre);
  const cargo = cleanText(body.cargo);
  const rol = cleanText(body.rol);
  const errors = {};

  if (!email) errors.email = 'El correo es obligatorio.';
  else if (email.length > 254 || !EMAIL_PATTERN.test(email) || email.includes('..')) {
    errors.email = 'El correo no tiene una estructura válida (ejemplo: nombre@institucion.cl).';
  }

  const nombreError = validateLetters(nombre, 'nombre');
  if (nombreError) errors.nombre = nombreError;

  const cargoError = validateLetters(cargo, 'cargo');
  if (cargoError) errors.cargo = cargoError;

  if (!isKnownRole(rol)) errors.rol = 'Seleccione un rol válido.';

  return { values: { email, nombre, cargo, rol }, errors };
}

function rejected(res, status, errors) {
  return res.status(status).json({
    error: 'No se incorporó a la persona: revise los datos marcados.',
    errors,
  });
}

const DUPLICATE_EMAIL = { email: 'Este correo ya pertenece a un integrante del equipo.' };

export async function listMembers(req, res) {
  const members = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { ...MEMBER_FIELDS, permissions: { select: { module: true, level: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(
    members.map(({ permissions = [], ...member }) => ({
      ...member,
      permissions: permissionView(member, permissions),
    }))
  );
}

// ── Permisos por módulo (HU19) ─────────────────────────────────────

/** Vista de permisos actuales: cada módulo con su nivel y de dónde sale. */
function permissionView(member, rows) {
  const effective = effectivePermissions(member.role, rows);
  const custom = new Set(rows.map((r) => r.module));
  return Object.values(MODULES).map((module) => ({
    module,
    label: MODULE_LABELS[module],
    level: effective[module],
    source: custom.has(module) ? 'personalizado' : 'rol',
  }));
}

async function findTarget(id) {
  return prisma.user.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      deletedAt: true,
      permissions: { select: { module: true, level: true } },
    },
  });
}

export async function getMemberPermissions(req, res) {
  const target = await findTarget(req.params.id);
  if (!target || target.deletedAt) return res.status(404).json({ error: 'Integrante no encontrado.' });
  const { permissions, ...member } = target;
  return res.json({ member, permissions: permissionView(member, permissions) });
}

export async function updateMemberPermission(req, res) {
  const { module, level } = req.body || {};
  const errors = {};
  if (!isKnownModule(module)) errors.module = 'Seleccione un módulo válido.';
  if (!isKnownLevel(level)) {
    errors.level = `El nivel debe ser ${Object.values(LEVELS).join(', ')}.`;
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'No se guardó el permiso: revise los datos.', errors });
  }

  const target = await findTarget(req.params.id);
  if (!target || target.deletedAt) return res.status(404).json({ error: 'Integrante no encontrado.' });
  // El admin accede a todo por definición; personalizarlo no tendría efecto.
  if (target.role === ROLES.ADMIN) {
    return res.status(400).json({ error: 'Los permisos de un administrador no se pueden personalizar.' });
  }

  await prisma.userPermission.upsert({
    where: { userId_module: { userId: target.id, module } },
    create: { userId: target.id, module, level },
    update: { level },
  });
  invalidatePermissions(target.id);

  const rows = [...target.permissions.filter((r) => r.module !== module), { module, level }];
  const { permissions, ...member } = target;
  return res.json({ member, permissions: permissionView(member, rows) });
}

export async function addMember(req, res) {
  const { values, errors } = validateMemberInput(req.body);
  if (Object.keys(errors).length) return rejected(res, 400, errors);

  const existing = await prisma.user.findUnique({ where: { email: values.email }, select: { id: true } });
  if (existing) return rejected(res, 409, DUPLICATE_EMAIL);

  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  let member;
  try {
    member = await prisma.user.create({
      data: {
        email: values.email,
        name: values.nombre,
        cargo: values.cargo,
        role: values.rol,
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
      },
      select: MEMBER_FIELDS,
    });
  } catch (error) {
    // Dos altas simultáneas del mismo correo: gana la primera.
    if (error?.code === 'P2002') return rejected(res, 409, DUPLICATE_EMAIL);
    throw error;
  }

  let notification;
  try {
    await sendTeamWelcomeEmail({
      recipientEmail: member.email,
      name: member.name,
      cargo: member.cargo,
      roleLabel: ROLE_LABELS[member.role],
      temporaryPassword,
      loginUrl: `${config.frontendUrl.replace(/\/$/, '')}/login`,
    });
    notification = { sent: true };
  } catch (error) {
    console.error(`HU18: no se pudo notificar la incorporación del usuario ${member.id}:`, error.message);
    // El acceso ya está concedido. Sin correo, la única forma de entregar la
    // contraseña es mostrársela una vez al Encargado.
    notification = {
      sent: false,
      error: 'El acceso quedó concedido, pero no se pudo enviar el correo de notificación.',
      temporaryPassword,
    };
  }

  return res.status(201).json({ member, notification });
}

// El borrado es lógico: se conserva la misma fila para que documentos,
// carpetas, solicitudes, borradores e hitos mantengan su autoría histórica.
// El correo se mueve a deletedEmail y se reemplaza por uno interno único, de
// modo que la dirección original puede reincorporarse después.
export async function deleteMember(req, res) {
  if (req.body?.confirmation !== 'entiendo') {
    return res.status(400).json({
      error: 'Para eliminar al integrante debe escribir exactamente “entiendo”.',
      code: 'CONFIRMATION_REQUIRED',
    });
  }

  const target = await findTarget(req.params.id);
  if (!target || target.deletedAt) return res.status(404).json({ error: 'Integrante no encontrado.' });
  if (target.role === ROLES.ADMIN) {
    return res.status(400).json({ error: 'Los administradores no se pueden eliminar.' });
  }

  const deletedAt = new Date();
  const tombstoneEmail = `deleted-${target.id}-${crypto.randomBytes(8).toString('hex')}@deleted.qualitrack.local`;
  const disabledPasswordHash = await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 10);

  await prisma.$transaction(async (tx) => {
    // Una sesión ya emitida conserva su JWT, por eso se deniegan todos los
    // módulos antes de responder y se invalida el caché tras confirmar.
    for (const module of Object.values(MODULES)) {
      await tx.userPermission.upsert({
        where: { userId_module: { userId: target.id, module } },
        create: { userId: target.id, module, level: LEVELS.DENEGADO },
        update: { level: LEVELS.DENEGADO },
      });
    }

    // Las credenciales de servicios externos dejan de pertenecer a una cuenta
    // eliminada. El contenido importado permanece intacto en el repositorio.
    await tx.cloudConnection.deleteMany({ where: { userId: target.id } });
    // Evita que un bloqueo anterior afecte a una reincorporación con el mismo
    // correo. Los LoginAttempt históricos se conservan porque son auditoría.
    await tx.loginThrottle.deleteMany({ where: { email: target.email.toLowerCase() } });

    await tx.user.update({
      where: { id: target.id },
      data: {
        email: tombstoneEmail,
        deletedEmail: target.email,
        deletedAt,
        passwordHash: disabledPasswordHash,
      },
    });

    await recordSecurityEvent({
      user: req.user,
      action: 'TEAM_MEMBER_DELETED',
      resourceType: 'team-member',
      resourceId: `${target.id} · ${target.name} · ${target.email}`,
    }, tx);
  });

  invalidatePermissions(target.id);
  return res.json({
    deleted: { id: target.id, name: target.name, email: target.email, deletedAt },
  });
}
