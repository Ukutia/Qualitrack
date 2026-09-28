import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config/env.js';
import { sendRequestEmail } from '../src/services/requestEmail.service.js';

const originalApiKey = config.brevoApiKey;
const originalFrom = config.smtp.from;

afterEach(() => {
  config.brevoApiKey = originalApiKey;
  config.smtp.from = originalFrom;
  vi.unstubAllGlobals();
});

describe('transporte HTTPS de Brevo', () => {
  it('prioriza la API y envía remitente, destinatario y enlace', async () => {
    config.brevoApiKey = 'test-api-key';
    config.smtp.from = 'Qualitrack <notificaciones@example.com>';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({ messageId: '<brevo-message-id>' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendRequestEmail({
      recipientEmail: 'persona@example.com',
      description: 'Certificado institucional',
      publicUrl: 'https://app.example.com/document-request/token',
      type: 'INITIAL',
    })).resolves.toEqual({ messageId: '<brevo-message-id>' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.headers['api-key']).toBe('test-api-key');
    expect(JSON.parse(options.body)).toMatchObject({
      sender: { name: 'Qualitrack', email: 'notificaciones@example.com' },
      to: [{ email: 'persona@example.com' }],
    });
    expect(JSON.parse(options.body).htmlContent).toContain('https://app.example.com/document-request/token');
  });

  it('propaga un error legible sin exponer la clave', async () => {
    config.brevoApiKey = 'secret-that-must-not-appear';
    config.smtp.from = 'notificaciones@example.com';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: vi.fn().mockResolvedValue({ message: 'Key not found' }),
    }));

    await expect(sendRequestEmail({
      recipientEmail: 'persona@example.com',
      description: 'Documento',
      publicUrl: 'https://app.example.com/document-request/token',
      type: 'REMINDER',
    })).rejects.toThrow('Brevo API rechazó el correo (401): Key not found');
  });
});
