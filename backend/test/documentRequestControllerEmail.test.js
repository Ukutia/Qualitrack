import { beforeEach, describe, expect, it, vi } from 'vitest';

const documentRequest = { create: vi.fn() };
const documentRequestEmail = { create: vi.fn() };
const kickRequestEmailDelivery = vi.fn();
const tx = { documentRequest, documentRequestEmail };

vi.mock('../src/config/prisma.js', () => ({
  prisma: { $transaction: vi.fn((callback) => callback(tx)) },
}));
vi.mock('../src/services/documentRequests.service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  kickRequestEmailDelivery,
}));
vi.mock('../src/controllers/documents.controller.js', () => ({ queueDocumentVectorization: vi.fn() }));

const { createDocumentRequest } = await import('../src/controllers/documentRequests.controller.js');

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('correo inicial de una solicitud', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea solicitud y correo inicial en una transacción y activa su envío', async () => {
    documentRequest.create.mockImplementation(async ({ data }) => ({
      id: 21,
      status: 'PENDING',
      tokenVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    documentRequestEmail.create.mockResolvedValue({ id: 55 });
    const req = {
      user: { id: 9, role: 'admin' },
      body: {
        recipientEmail: 'persona@example.com',
        description: 'Certificado institucional vigente',
        reminderIntervalDays: 1,
      },
    };
    const res = response();

    await createDocumentRequest(req, res);

    expect(res.statusCode).toBe(201);
    expect(documentRequestEmail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: 21,
        tokenVersion: 1,
        type: 'INITIAL',
        status: 'PENDING',
      }),
    });
    expect(kickRequestEmailDelivery).toHaveBeenCalledWith(55);
  });
});
