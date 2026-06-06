import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

// ── Documentos (HU07) ───────────────────────────────────────────────
export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => (await api.get('/documents')).data,
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
    mutationFn: async ({ associationId, action }) =>
      (await api.post(`/associations/${associationId}/${action}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document'] });
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
    mutationFn: async ({ fileId, location }) =>
      (await api.post('/cloud/google/import', { fileId, location })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}
