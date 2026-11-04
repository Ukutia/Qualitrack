import { beforeEach, describe, expect, it, vi } from 'vitest';

const documentRequest = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
};
vi.mock('../src/config/prisma.js', () => ({ prisma: { documentRequest } }));
vi.mock('../src/controllers/documents.controller.js', () => ({ queueDocumentVectorization: vi.fn() }));

const { deleteDocumentRequest, listDocumentRequests } = await import('../src/controllers/documentRequests.controller.js');

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send() { return this; },
  };
}

const request = { params: { id: '8' }, user: { id: 3, role: 'user' } };

describe('eliminación de solicitudes', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['PENDING', 'PAUSED', 'CANCELLED', 'RECEIVED'])('permite eliminar una solicitud compartida %s', async (status) => {
    documentRequest.findFirst.mockResolvedValue({ id: 8, createdById: 99, status });
    documentRequest.deleteMany.mockResolvedValue({ count: 1 });
    const res = response();

    await deleteDocumentRequest(request, res);

    expect(res.statusCode).toBe(204);
    expect(documentRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: 8 },
    });
  });
});

describe('listado y seguimiento de solicitudes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('incluye el documento asociado y el historial de correos', async () => {
    const createdAt = new Date('2026-11-04T12:00:00.000Z');
    const sentAt = new Date('2026-11-04T12:01:00.000Z');
    documentRequest.findMany.mockResolvedValue([{
      id: 8,
      recipientEmail: 'destino@universidad.cl',
      description: 'Resolución vigente',
      status: 'RECEIVED',
      reminderIntervalMinutes: 1440,
      nextReminderAt: null,
      tokenEncrypted: null,
      tokenVersion: 1,
      tokenCreatedAt: null,
      createdAt,
      updatedAt: sentAt,
      createdBy: { id: 99, name: 'Otra persona' },
      documentId: 19,
      document: { id: 19, originalName: 'resolucion.pdf', format: 'pdf', sizeBytes: 2048, uploadedAt: sentAt, deletedAt: null },
      emails: [{ id: 3, tokenVersion: 1, type: 'INITIAL', status: 'SENT', attemptCount: 1, createdAt, sentAt, lastAttemptAt: createdAt, lastError: 'SMTP interno' }],
    }]);
    const res = response();

    await listDocumentRequests(request, res);

    expect(documentRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      include: expect.objectContaining({ createdBy: expect.any(Object), document: expect.any(Object), emails: expect.any(Object) }),
    }));
    expect(res.body[0]).toMatchObject({
      documentId: 19,
      createdBy: { id: 99, name: 'Otra persona' },
      document: { id: 19, originalName: 'resolucion.pdf' },
      emails: [{ id: 3, status: 'SENT', sentAt }],
    });
    expect(res.body[0].emails[0]).not.toHaveProperty('lastError');
  });
});
