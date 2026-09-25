import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let transport;

function smtpConfigured() {
  return Boolean(config.smtp.host && config.smtp.from);
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

  return getTransport().sendMail({
    from: config.smtp.from,
    to: recipientEmail,
    subject,
    text,
    html,
  });
}

export function requestEmailConfigurationStatus() {
  return { configured: smtpConfigured(), host: config.smtp.host, port: config.smtp.port };
}

export function resetRequestEmailTransportForTests() {
  transport = undefined;
}
