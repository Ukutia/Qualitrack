import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import {
  useCloudStatus,
  useCloudFiles,
  useImportCloudFile,
} from '../hooks/useApi.js';

export default function CloudConnect() {
  const [params] = useSearchParams();
  const { data: status, isLoading } = useCloudStatus();
  const connected = status?.connected;
  const [folderId, setFolderId] = useState('root');
  const [stack, setStack] = useState([]); // navegación de carpetas
  const filesQuery = useCloudFiles(folderId, !!connected);
  const importFile = useImportCloudFile();
  const [feedback, setFeedback] = useState(
    params.get('connected') === '1'
      ? { type: 'success', text: 'Cuenta de Google Drive conectada.' }
      : params.get('connected') === '0'
      ? { type: 'error', text: 'No fue posible conectar Google Drive.' }
      : null
  );

  async function connect() {
    try {
      const { data } = await api.get('/cloud/google/auth-url');
      window.location.href = data.url;
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'No configurado.' });
    }
  }

  function openFolder(file) {
    setStack((s) => [...s, { id: folderId, name: file.name }]);
    setFolderId(file.id);
  }
  function goBack() {
    const prev = stack[stack.length - 1];
    setStack((s) => s.slice(0, -1));
    setFolderId(prev ? prev.id : 'root');
  }

  async function doImport(file) {
    setFeedback(null);
    try {
      const res = await importFile.mutateAsync({ fileId: file.id, location: file.location });
      setFeedback({ type: 'success', text: res.message });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Error al importar.' });
    }
  }

  if (isLoading) return <p className="text-slate-500">Cargando…</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Google Drive</h1>
        <p className="text-slate-500 mt-1">
          Importe evidencias directamente desde su almacenamiento en la nube.
        </p>
      </header>

      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            feedback.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* No configurado */}
      {status?.configured === false && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 space-y-3">
          <h2 className="font-semibold text-slate-800">Integración no configurada</h2>
          <p className="text-sm text-slate-600">{status.message}</p>
          <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
            <li>Cree credenciales OAuth (tipo “Aplicación web”) en Google Cloud Console.</li>
            <li>
              Agregue el redirect URI:{' '}
              <code className="bg-slate-200 px-1 rounded">
                http://localhost:4000/api/cloud/google/callback
              </code>
            </li>
            <li>
              Defina <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_CLIENT_SECRET</code> en{' '}
              <code>.env</code> y reinicie los contenedores.
            </li>
          </ol>
        </div>
      )}

      {/* Configurado pero no conectado */}
      {status?.configured && !connected && (
        <button
          onClick={connect}
          className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-medium"
        >
          Conectar Google Drive
        </button>
      )}

      {/* Conectado: navegador de archivos */}
      {connected && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-3">
            {stack.length > 0 && (
              <button onClick={goBack} className="text-sm text-brand-600 hover:underline">
                ← Atrás
              </button>
            )}
            <span className="text-sm text-slate-500">
              {stack.length === 0 ? 'Mi unidad' : stack.map((s) => s.name).join(' / ')}
            </span>
          </div>

          {filesQuery.isLoading ? (
            <p className="text-slate-500 text-sm">Cargando archivos…</p>
          ) : filesQuery.data?.connected === false || filesQuery.error ? (
            <p className="text-rose-600 text-sm">
              {filesQuery.data?.error ||
                'No fue posible establecer conexión con la cuenta seleccionada.'}
            </p>
          ) : filesQuery.data?.files?.length === 0 ? (
            <p className="text-slate-500 text-sm">
              {filesQuery.data.message || 'No existen documentos almacenados en esta ubicación.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filesQuery.data.files.map((f) => (
                <li key={f.id} className="py-2.5 flex items-center justify-between gap-3">
                  <button
                    onClick={() => f.isFolder && openFolder(f)}
                    className={`text-sm text-left ${f.isFolder ? 'text-brand-600 hover:underline font-medium' : 'text-slate-700'}`}
                  >
                    {f.isFolder ? '📁 ' : '📄 '}
                    {f.name}
                    {f.modifiedTime && (
                      <span className="text-xs text-slate-400 ml-2">
                        {new Date(f.modifiedTime).toLocaleDateString('es-CL')}
                      </span>
                    )}
                  </button>
                  {!f.isFolder && (
                    <button
                      onClick={() => doImport(f)}
                      disabled={importFile.isPending}
                      className="rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 px-3 py-1 text-xs font-medium"
                    >
                      Importar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
