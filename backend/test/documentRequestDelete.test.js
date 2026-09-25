import { beforeEach, describe, expect, it, vi } from 'vitest';

const documentRequest = {
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
};
vi.mock('../src/config/prisma.js', () => ({ prisma: { documentRequest } }));
vi.mock('../src/controllers/documents.controller.js', () => ({ queueDocumentVectorization: vi.fn() }));

const { deleteDocumentRequest } = await import('../src/controllers/documentRequests.controller.js');

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

  it.each(['PAUSED', 'CANCELLED'])('permite eliminar una solicitud %s propia', async (status) => {
    documentRequest.findFirst.mockResolvedValue({ id: 8, createdById: 3, status });
    documentRequest.deleteMany.mockResolvedValue({ count: 1 });
    const res = response();

    await deleteDocumentRequest(request, res);

    expect(res.statusCode).toBe(204);
    expect(documentRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: 8, createdById: 3, status: { in: ['PAUSED', 'CANCELLED'] } },
    });
  });

  it.each(['PENDING', 'RECEIVED'])('rechaza eliminar una solicitud %s', async (status) => {
    documentRequest.findFirst.mockResolvedValue({ id: 8, createdById: 3, status });
    const res = response();

    await deleteDocumentRequest(request, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('INVALID_STATUS');
    expect(documentRequest.deleteMany).not.toHaveBeenCalled();
  });
});
