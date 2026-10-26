import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let transport;

function smtpConfigured() {
  return Boolean(config.smtp.host && config.smtp.from);
}

function brevoApiConfigured() {
  return Boolean(config.brevoApiKey && config.smtp.from);
}

function getTransport() {
  if (!smtpConfigured()) {
    const error = new Error('SMTP no está configurado. Defina SMTP_HOST y MAIL_FROM.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      requireTLS: config.smtp.useTls && config.smtp.port !== 465,
      auth: config.smtp.username
        ? { user: config.smtp.username, pass: config.smtp.password }
        : undefined,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 30_000,
    });
  }
  return transport;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function subjectFor(type) {
  return type === 'REMINDER'
    ? 'Recordatorio: documento pendiente para Qualitrack'
    : 'Solicitud de documento para Qualitrack';
}

function parseSender(value) {
  const match = String(value).match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/);
  if (!match) return { email: String(value).trim() };
  const name = match[1]?.trim();
  return { email: match[2].trim(), ...(name ? { name } : {}) };
}

async function sendWithBrevoApi({ recipientEmail, subject, text, html }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: parseSender(config.smtp.from),
      to: [{ email: recipientEmail }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Brevo API rechazó el correo (${response.status}): ${body.message || response.statusText}`);
    error.code = 'BREVO_API_ERROR';
    throw error;
  }
  return { messageId: body.messageId || null };
}

export async function sendRequestEmail({ recipientEmail, description, publicUrl, type }) {
  const subject = subjectFor(type);
  const intro = type === 'REMINDER'
    ? 'Te recordamos que aún está pendiente el siguiente documento:'
    : 'Se ha solicitado el siguiente documento:';
  const text = `${intro}\n\n${description}\n\nCarga el archivo aquí:\n${publicUrl}\n\nEste enlace reemplaza cualquier enlace anterior y dejará de funcionar cuando se reciba el documento o se genere un nuevo recordatorio.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#20242c;max-width:620px">
      <h1 style="font-size:22px">${escapeHtml(subject)}</h1>
      <p>${escapeHtml(intro)}</p>
      <div style="padding:16px;background:#f5f6f8;border-radius:8px">${escapeHtml(description)}</div>
      <p style="margin:24px 0">
        <a href="${escapeHtml(publicUrl)}" style="background:#315fc4;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Cargar documento</a>
      </p>
      <p style="font-size:13px;color:#667085">Este enlace reemplaza cualquier enlace anterior y dejará de funcionar cuando se reciba el documento o se genere un nuevo recordatorio.</p>
    </div>`;

  return deliver({ recipientEmail, subject, text, html });
}

// Mismo canal (API de Brevo o SMTP) para todos los correos de Qualitrack.
function deliver({ recipientEmail, subject, text, html }) {
  if (brevoApiConfigured()) {
    return sendWithBrevoApi({ recipientEmail, subject, text, html });
  }

  return getTransport().sendMail({
    from: config.smtp.from,
    to: recipientEmail,
    subject,
    text,
    html,
  });
}

/**
 * HU18 — Aviso de incorporación al equipo. Es solo informativo: el acceso ya
 * está concedido y no hay nada que aceptar ni rechazar. La contraseña temporal
 * viaja únicamente en este correo; nunca se registra en los logs.
 */
export async function sendTeamWelcomeEmail({ recipientEmail, name, cargo, roleLabel, temporaryPassword, loginUrl }) {
  const subject = 'Se te concedió acceso a Qualitrack';
  const text = [
    `Hola ${name}:`,
    '',
    `El Encargado de Aseguramiento de la Calidad te incorporó al equipo de Qualitrack como ${cargo}.`,
    `Tu acceso ya está activo con el rol "${roleLabel}". No necesitas aceptar ni responder este correo.`,
    '',
    `Ingresa en ${loginUrl} con:`,
    `Correo: ${recipientEmail}`,
    `Contraseña temporal: ${temporaryPassword}`,
    '',
    'Por seguridad, no compartas esta contraseña. Si no la recibiste completa o necesitas otra, pídesela al Encargado de Aseguramiento de la Calidad.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#20242c;max-width:620px">
      <h1 style="font-size:22px">${escapeHtml(subject)}</h1>
      <p>Hola ${escapeHtml(name)}:</p>
      <p>El Encargado de Aseguramiento de la Calidad te incorporó al equipo de Qualitrack como <strong>${escapeHtml(cargo)}</strong>.
      Tu acceso ya está activo con el rol <strong>${escapeHtml(roleLabel)}</strong>. No necesitas aceptar ni responder este correo.</p>
      <div style="padding:16px;background:#f5f6f8;border-radius:8px">
        <p style="margin:0">Correo: <strong>${escapeHtml(recipientEmail)}</strong></p>
        <p style="margin:8px 0 0">Contraseña temporal: <code style="font-size:15px">${escapeHtml(temporaryPassword)}</code></p>
      </div>
      <p style="margin:24px 0">
        <a href="${escapeHtml(loginUrl)}" style="background:#315fc4;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Ingresar a Qualitrack</a>
      </p>
      <p style="font-size:13px;color:#667085">Por seguridad, no compartas esta contraseña. Si necesitas otra, pídesela al Encargado de Aseguramiento de la Calidad.</p>
    </div>`;

  return deliver({ recipientEmail, subject, text, html });
}

export function requestEmailConfigurationStatus() {
  return {
    configured: brevoApiConfigured() || smtpConfigured(),
    transport: brevoApiConfigured() ? 'brevo-api' : 'smtp',
    host: config.smtp.host,
    port: config.smtp.port,
  };
}

export function resetRequestEmailTransportForTests() {
  transport = undefined;
}
