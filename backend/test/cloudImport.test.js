// HU09 — Importación de evidencias desde la nube conectada.
// Se mockean el proveedor, la persistencia y el almacenamiento: aquí se prueban
// las reglas del controlador (formato, tamaño, duplicados), no la API externa.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/env.js', () => ({
  config: {
    maxFileSizeMb: 10,
    google: { redirectUri: 'http://localhost:4000/api/cloud/google/callback' },
    dropbox: { redirectUri: 'http://localhost:4000/api/cloud/dropbox/callback' },
  },
  isGoogleConfigured: () => true,
  isDropboxConfigured: () => true,
  maxFileSizeBytes: () => 10 * 1024 * 1024,
}));

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    document: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    cloudConnection: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../src/services/googleDrive.service.js', () => ({
  getFileMeta: vi.fn(),
  downloadFile: vi.fn(),
  isConnected: vi.fn(),
  listFiles: vi.fn(),
  getAuthUrl: vi.fn(),
  handleCallback: vi.fn(),
}));

vi.mock('../src/services/dropbox.service.js', () => ({
  getFileMeta: vi.fn(),
  downloadFile: vi.fn(),
  isConnected: vi.fn(),
  listFiles: vi.fn(),
  getAuthUrl: vi.fn(),
  handleCallback: vi.fn(),
}));

vi.mock('../src/services/storage.service.js', () => ({ deleteFile: vi.fn() }));

vi.mock('../src/controllers/documents.controller.js', () => ({
  ingestDocument: vi.fn(),
}));

const { importFile, dropboxImportFile } = await import('../src/controllers/cloud.controller.js');
const drive = await import('../src/services/googleDrive.service.js');
const dropbox = await import('../src/services/dropbox.service.js');
const { prisma } = await import('../src/config/prisma.js');
const { deleteFile } = await import('../src/services/storage.service.js');
const { ingestDocument } = await import('../src/controllers/documents.controller.js');

const makeReq = (body = {}, query = {}) => ({ body, query, user: { id: 1 } });

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const PDF = (name = 'informe.pdf', sizeBytes = 1024) => ({ name, mimeType: 'application/pdf', sizeBytes });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.document.findFirst.mockResolvedValue(null);
  ingestDocument.mockImplementation(async ({ originalName, source }) => ({
    id: 99,
    originalName,
    format: 'pdf',
    sizeBytes: 1024,
    uploadedAt: new Date(),
    source,
  }));
});

describe('importación desde Google Drive (HU09)', () => {
  it('rechaza la solicitud sin fileId', async () => {
    const res = makeRes();
    await importFile(makeReq({}), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/fileId/);
  });

  it('importa el archivo sin que el usuario tenga que descargarlo', async () => {
    drive.getFileMeta.mockResolvedValue(PDF());
    drive.downloadFile.mockResolvedValue({ name: 'informe.pdf', buffer: Buffer.alloc(1024) });

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc', location: 'Evidencias/2026' }), res);

    expect(res.statusCode).toBe(201);
    expect(ingestDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        originalName: 'informe.pdf',
        source: 'GOOGLE_DRIVE',
        cloudFileId: 'abc',
        cloudLocation: 'Evidencias/2026',
      })
    );
    expect(res.body.message).toContain('Google Drive');
  });

  it('rechaza formatos no aceptados sin descargar el archivo', async () => {
    drive.getFileMeta.mockResolvedValue(PDF('foto.png'));

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_FORMAT');
    expect(drive.downloadFile).not.toHaveBeenCalled();
  });

  it('rechaza archivos sobre el máximo usando el metadato, sin descargarlos', async () => {
    drive.getFileMeta.mockResolvedValue(PDF('pesado.pdf', 12 * 1024 * 1024));

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
    expect(drive.downloadFile).not.toHaveBeenCalled();
  });

  it('detecta el exceso de tamaño tras descargar cuando el proveedor no informa el peso', async () => {
    drive.getFileMeta.mockResolvedValue({ name: 'nativo.docx', mimeType: 'x', sizeBytes: null });
    drive.downloadFile.mockResolvedValue({ name: 'nativo.docx', buffer: Buffer.alloc(11 * 1024 * 1024) });

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
    expect(ingestDocument).not.toHaveBeenCalled();
  });

  it('informa un error legible si la cuenta ya no responde', async () => {
    drive.getFileMeta.mockRejectedValue(new Error('invalid_grant'));

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('CLOUD_CONNECTION_ERROR');
    expect(res.body.retryable).toBe(true);
    expect(res.body.connected).toBe(false);
    expect(prisma.cloudConnection.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1, provider: 'google' },
    });
    expect(res.body.error).toMatch(/Reconecte la cuenta/);
  });

  it('hace idempotente el reintento si el documento ya fue incorporado', async () => {
    drive.getFileMeta.mockResolvedValue(PDF());
    prisma.document.findFirst.mockResolvedValue({
      id: 44,
      originalName: 'informe.pdf',
      format: 'pdf',
      sizeBytes: 1024,
      uploadedAt: new Date(),
      deletedAt: null,
      source: 'GOOGLE_DRIVE',
      cloudFileId: 'abc',
    });

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.alreadyImported).toBe(true);
    expect(res.body.id).toBe(44);
    expect(drive.downloadFile).not.toHaveBeenCalled();
    expect(ingestDocument).not.toHaveBeenCalled();
  });
});

describe('duplicados al importar desde la nube', () => {
  const existing = {
    id: 7,
    originalName: 'informe.pdf',
    documentDate: new Date('2025-01-01'),
    uploadedAt: new Date('2025-02-01'),
    deletedAt: null,
    storagePath: '/data/informe.pdf',
  };

  it('pide confirmación (409) antes de importar un nombre ya existente', async () => {
    drive.getFileMeta.mockResolvedValue(PDF());
    prisma.document.findFirst.mockResolvedValue(existing);

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
    expect(res.body.existing.inTrash).toBe(false);
    expect(drive.downloadFile).not.toHaveBeenCalled();
  });

  it('señala cuando el duplicado está en la papelera', async () => {
    drive.getFileMeta.mockResolvedValue(PDF());
    prisma.document.findFirst.mockResolvedValue({ ...existing, deletedAt: new Date('2026-03-01') });

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.existing.inTrash).toBe(true);
  });

  it('"restore" recupera el documento de la papelera sin importar nada', async () => {
    drive.getFileMeta.mockResolvedValue(PDF());
    prisma.document.findFirst.mockResolvedValue({ ...existing, deletedAt: new Date('2026-03-01') });

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc' }, { onDuplicate: 'restore' }), res);

    expect(res.statusCode).toBe(200);
    expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { deletedAt: null } });
    expect(drive.downloadFile).not.toHaveBeenCalled();
    expect(ingestDocument).not.toHaveBeenCalled();
  });

  it('"replace" elimina el documento anterior y su archivo', async () => {
    drive.getFileMeta.mockResolvedValue(PDF());
    drive.downloadFile.mockResolvedValue({ name: 'informe.pdf', buffer: Buffer.alloc(10) });
    prisma.document.findFirst.mockResolvedValue(existing);

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc' }, { onDuplicate: 'replace' }), res);

    expect(deleteFile).toHaveBeenCalledWith('/data/informe.pdf');
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(res.statusCode).toBe(201);
    expect(ingestDocument.mock.calls[0][0].originalName).toBe('informe.pdf');
  });

  it('"keep" conserva ambos renombrando la copia importada', async () => {
    drive.getFileMeta.mockResolvedValue(PDF());
    drive.downloadFile.mockResolvedValue({ name: 'informe.pdf', buffer: Buffer.alloc(10) });
    prisma.document.findFirst.mockResolvedValue(existing);

    const res = makeRes();
    await importFile(makeReq({ fileId: 'abc' }, { onDuplicate: 'keep' }), res);

    expect(res.statusCode).toBe(201);
    expect(prisma.document.delete).not.toHaveBeenCalled();
    expect(ingestDocument.mock.calls[0][0].originalName).toMatch(/^informe \(copia \d+\)\.pdf$/);
  });
});

describe('importación desde Dropbox', () => {
  it('aplica las mismas reglas y registra el origen DROPBOX', async () => {
    dropbox.getFileMeta.mockResolvedValue(PDF('acta.pdf'));
    dropbox.downloadFile.mockResolvedValue({ name: 'acta.pdf', buffer: Buffer.alloc(512) });

    const res = makeRes();
    await dropboxImportFile(makeReq({ fileId: '/evidencias/acta.pdf' }), res);

    expect(res.statusCode).toBe(201);
    expect(ingestDocument).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'DROPBOX', cloudFileId: '/evidencias/acta.pdf' })
    );
    expect(res.body.message).toContain('Dropbox');
  });

  it('pide confirmación ante un nombre duplicado', async () => {
    dropbox.getFileMeta.mockResolvedValue(PDF('acta.pdf'));
    prisma.document.findFirst.mockResolvedValue({
      id: 3, originalName: 'acta.pdf', documentDate: new Date(), uploadedAt: new Date(), deletedAt: null,
    });

    const res = makeRes();
    await dropboxImportFile(makeReq({ fileId: '/evidencias/acta.pdf' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
    expect(dropbox.downloadFile).not.toHaveBeenCalled();
  });
});
