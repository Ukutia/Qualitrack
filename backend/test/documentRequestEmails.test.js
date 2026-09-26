import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendRequestEmail = vi.fn();
vi.mock('../src/services/requestEmail.service.js', () => ({ sendRequestEmail }));

const {
  deliverRequestEmail,
  rotateDueDocumentRequests,
} = await import('../src/services/documentRequests.service.js');
const { createRequestToken } = await import('../src/services/requestToken.service.js');

describe('correos de solicitudes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rota token y registra un único recordatorio en la misma transacción', async () => {
    const now = new Date('2026-09-24T10:00:00.000Z');
    const dueAt = new Date('2026-09-24T09:59:00.000Z');
    const tx = {
      documentRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      documentRequestEmail: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: 31 }),
      },
    };
    const db = {
      documentRequest: {
        findMany: vi.fn().mockResolvedValue([{
          id: 7,
          tokenVersion: 3,
          nextReminderAt: dueAt,
          reminderIntervalMinutes: 5,
        }]),
      },
      $transaction: vi.fn((callback) => callback(tx)),
    };

    await expect(rotateDueDocumentRequests(now, db)).resolves.toBe(1);
    expect(tx.documentRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 7, tokenVersion: 3, nextReminderAt: dueAt }),
      data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
    }));
    expect(tx.documentRequestEmail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: 7,
        tokenVersion: 4,
        type: 'REMINDER',
        status: 'PENDING',
      }),
    });
  });

  it('envía usando solo el token vigente y registra la entrega', async () => {
    const token = createRequestToken();
    const now = new Date('2026-09-24T10:00:00.000Z');
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      documentRequestEmail: {
        updateMany,
        findUnique: vi.fn().mockResolvedValue({
          id: 15,
          tokenVersion: 2,
          type: 'REMINDER',
          request: {
            status: 'PENDING',
            tokenVersion: 2,
            tokenEncrypted: token.tokenEncrypted,
            recipientEmail: 'persona@example.com',
            description: 'Certificado vigente',
          },
        }),
      },
    };
    sendRequestEmail.mockResolvedValue({ messageId: 'brevo-123' });

    await expect(deliverRequestEmail(15, now, db)).resolves.toBe(true);
    expect(sendRequestEmail).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: 'persona@example.com',
      type: 'REMINDER',
      publicUrl: expect.stringMatching(/\/document-request\/[A-Za-z0-9_-]{43}$/),
    }));
    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SENT', providerMessageId: 'brevo-123' }),
    }));
  });

  it('cancela el correo si su versión ya no coincide con el token vigente', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      documentRequestEmail: {
        updateMany,
        findUnique: vi.fn().mockResolvedValue({
          id: 16,
          tokenVersion: 1,
          type: 'INITIAL',
          request: { status: 'PENDING', tokenVersion: 2, tokenEncrypted: 'irrelevante' },
        }),
      },
    };

    await expect(deliverRequestEmail(16, new Date(), db)).resolves.toBe(false);
    expect(sendRequestEmail).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { status: 'CANCELLED' },
    }));
  });
});
