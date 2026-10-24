import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchSimilarChunks = vi.hoisted(() => vi.fn());
const getNetwork = vi.hoisted(() => vi.fn());

vi.mock('../src/config/env.js', () => ({
  config: {
    embeddings: {
      enabled: false,
      serviceUrl: 'http://embedding.invalid',
      timeoutMs: 1000,
    },
  },
}));
vi.mock('../src/services/vector.service.js', () => ({ searchSimilarChunks }));
vi.mock('../src/services/network.service.js', () => ({ getNetwork }));
vi.mock('../src/config/prisma.js', () => ({ prisma: {} }));
vi.mock('../src/services/encryption.service.js', () => ({ decryptText: vi.fn() }));

const { semanticSearch } = await import('../src/controllers/search.controller.js');
const { network } = await import('../src/controllers/network.controller.js');
const { generateEmbedding } = await import('../src/services/embedding.service.js');

function response() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe('embeddings desactivados', () => {
  it('rechaza la búsqueda semántica sin llamar al servicio', async () => {
    const res = response();
    await semanticSearch({ body: { query: 'retención' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMBEDDINGS_DISABLED' }));
    expect(searchSimilarChunks).not.toHaveBeenCalled();
  });

  it('rechaza la red temática sin calcular embeddings', async () => {
    const res = response();
    await network({ user: { id: 1 } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503);
    expect(getNetwork).not.toHaveBeenCalled();
  });

  it('falla inmediatamente antes de realizar una petición HTTP', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(generateEmbedding('texto')).rejects.toMatchObject({ code: 'EMBEDDINGS_DISABLED' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
