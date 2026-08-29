import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

// ── Documentos (HU07) ───────────────────────────────────────────────
export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => (await api.get('/documents')).data,
  });
}

// ── Búsqueda semántica ──────────────────────────────────────────────
export function useSemanticSearch() {
  return useMutation({
    mutationFn: async ({ query, limit = 30 }) =>
      (
        await api.post('/search/semantic', {
          query,
          limit,
        })
      ).data,
  });
}

// ── Temáticas ───────────────────────────────────────────────────────
export function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn: async () => (await api.get('/topics')).data,
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (name) =>
      (
        await api.post('/topics', {
          name,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topics'] });
    },
  });
}

export function useDocument(id) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: async () => (await api.get(`/documents/${id}`)).data,
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, onDuplicate }) => {
      const form = new FormData();
      form.append('file', file);
      const q = onDuplicate ? `?onDuplicate=${onDuplicate}` : '';
      return (await api.post(`/documents${q}`, form)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useTrashDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/documents/${id}/trash`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['compliance'] });
    },
  });
}

export function useTrash() {
  return useQuery({
    queryKey: ['trash'],
    queryFn: async () => (await api.get('/documents/trash')).data,
  });
}

export function useRestoreDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/documents/${id}/restore`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['compliance'] });
    },
  });
}

export function useDestroyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/documents/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trash'] }),
  });
}

// ── Clasificación (HU01) ────────────────────────────────────────────
export function useClassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId) => (await api.post(`/documents/${docId}/classify`)).data,
    onSuccess: (_d, docId) => {
      qc.invalidateQueries({ queryKey: ['document', String(docId)] });
      qc.invalidateQueries({ queryKey: ['document', docId] });
    },
  });
}

export function useAssociationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ associationId, action, documentId }) =>
      (await api.post(`/associations/${associationId}/${action}`)).data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['compliance'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
      if (variables.documentId) {
        qc.invalidateQueries({ queryKey: ['document', String(variables.documentId)] });
        qc.invalidateQueries({ queryKey: ['document', variables.documentId] });
      }
    },
  });
}

// ── Cumplimiento (HU02) ─────────────────────────────────────────────
export function useCompliance() {
  return useQuery({
    queryKey: ['compliance'],
    queryFn: async () => (await api.get('/compliance')).data,
  });
}

// ── Estructura del informe (HU03) ───────────────────────────────────
export function useReportStructure() {
  return useQuery({
    queryKey: ['report-structure'],
    queryFn: async () => (await api.get('/report-structure')).data,
  });
}

export function useUploadStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sections) => (await api.post('/report-structure', { sections })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-structure'] }),
  });
}

export function useParseStructureDoc() {
  return useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('file', file);
      return (await api.post('/report-structure/parse', form)).data;
    },
  });
}

export function useStructureHistory() {
  return useQuery({
    queryKey: ['report-structure-history'],
    queryFn: async () => (await api.get('/report-structure/history')).data,
  });
}

export function useRestoreStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (version) => (await api.post(`/report-structure/${version}/restore`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-structure'] });
      qc.invalidateQueries({ queryKey: ['report-structure-history'] });
    },
  });
}

// ── Redacción del informe (borradores) ──────────────────────────────
export function useReportDrafts() {
  return useQuery({
    queryKey: ['report-drafts'],
    queryFn: async () => (await api.get('/report-drafts')).data,
  });
}

export function useReportDraft(id) {
  return useQuery({
    queryKey: ['report-draft', id],
    queryFn: async () => (await api.get(`/report-drafts/${id}`)).data,
    enabled: !!id,
    // El contenido vive en el editor mientras se redacta: un refetch
    // pisaría lo que el usuario está escribiendo.
    staleTime: Infinity,
    gcTime: 0,
  });
}

export function useCreateReportDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload = {}) => (await api.post('/report-drafts', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-drafts'] }),
  });
}

export function useSaveReportDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, contentHtml }) => {
      const body = {};
      if (title !== undefined) body.title = title;
      if (contentHtml !== undefined) body.contentHtml = contentHtml;
      return (await api.put(`/report-drafts/${id}`, body)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-drafts'] }),
  });
}

export function useDeleteReportDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/report-drafts/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-drafts'] }),
  });
}

export function useReportDraftHistory(id) {
  return useQuery({
    queryKey: ['report-draft-history', id],
    queryFn: async () => (await api.get(`/report-drafts/${id}/history`)).data,
    enabled: !!id,
  });
}

export function useRestoreReportDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }) =>
      (await api.post(`/report-drafts/${id}/versions/${version}/restore`)).data,
    onSuccess: (data, { id }) => {
      // Se escribe la respuesta directo en la caché en vez de solo invalidar:
      // `useReportDraft` tiene staleTime Infinity y el remontaje del editor
      // no debe correr contra un refetch todavía en vuelo.
      qc.setQueryData(['report-draft', id], (prev) =>
        prev ? { ...prev, title: data.title, contentHtml: data.contentHtml, updatedAt: data.updatedAt } : prev
      );
      qc.invalidateQueries({ queryKey: ['report-drafts'] });
      qc.invalidateQueries({ queryKey: ['report-draft-history', id] });
    },
  });
}

// ── Google Drive (HU09) ─────────────────────────────────────────────
export function useCloudStatus() {
  return useQuery({
    queryKey: ['cloud-status'],
    queryFn: async () => (await api.get('/cloud/google/status')).data,
  });
}

export function useCloudFiles(folderId, enabled) {
  return useQuery({
    queryKey: ['cloud-files', folderId || 'root'],
    queryFn: async () =>
      (await api.get('/cloud/google/files', { params: { folderId } })).data,
    enabled,
  });
}

export function useImportCloudFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fileId, location, onDuplicate }) => {
      const q = onDuplicate ? `?onDuplicate=${onDuplicate}` : '';
      return (await api.post(`/cloud/google/import${q}`, { fileId, location })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

// ── Dropbox (HU10) ──────────────────────────────────────────────────
export function useDropboxStatus() {
  return useQuery({
    queryKey: ['dropbox-status'],
    queryFn: async () => (await api.get('/cloud/dropbox/status')).data,
  });
}

export function useDropboxFiles(folderPath, enabled) {
  return useQuery({
    queryKey: ['dropbox-files', folderPath || ''],
    queryFn: async () =>
      (await api.get('/cloud/dropbox/files', { params: { folderPath } })).data,
    enabled,
  });
}

export function useImportDropboxFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fileId, location, onDuplicate }) => {
      const q = onDuplicate ? `?onDuplicate=${onDuplicate}` : '';
      return (await api.post(`/cloud/dropbox/import${q}`, { fileId, location })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
