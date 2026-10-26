// HU18 — El Encargado de Aseguramiento de la Calidad (admin) incorpora personas
// al equipo. El acceso se concede de inmediato con el rol elegido y se avisa por
// correo; la persona no acepta ni rechaza nada.
//
// La ruta no figura en las reglas de user/ingestor (config/roles.js), así que
// enforceRolePolicy la deniega con 403 a cualquier rol que no sea admin.
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { ROLE_LABELS, isKnownRole } from '../config/roles.js';
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
    select: MEMBER_FIELDS,
    orderBy: { createdAt: 'desc' },
  });
  return res.json(members);
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
