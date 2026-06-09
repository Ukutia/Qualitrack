import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import {
  useCloudStatus,
  useCloudFiles,
  useImportCloudFile,
  useDropboxStatus,
  useDropboxFiles,
  useImportDropboxFile,
  useDisconnectCloud,
} from '../hooks/useApi.js';

const PROVIDERS = [
  { id: 'google', label: 'Google Drive', icon: '🟢' },
  { id: 'dropbox', label: 'Dropbox',      icon: '🔵' },
];

function FileBrowser({ filesQuery, onImport, importPending, onOpenFolder, onBack, stack, folderLabel }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-3">
        {stack.length > 0 && (
          <button onClick={onBack} className="text-sm text-brand-600 hover:underline">← Atrás</button>
        )}
        <span className="text-sm text-slate-500">{folderLabel}</span>
      </div>
      {filesQuery.isLoading ? (
        <p className="text-slate-500 text-sm">Cargando archivos…</p>
      ) : filesQuery.data?.connected === false || filesQuery.error ? (
        <p className="text-rose-600 text-sm">
          {filesQuery.data?.error || 'No fue posible establecer conexión.'}
        </p>
      ) : filesQuery.data?.files?.length === 0 ? (
        <p className="text-slate-500 text-sm">No existen documentos en esta ubicación.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filesQuery.data.files.map((f) => (
            <li key={f.id} className="py-2.5 flex items-center justify-between gap-3">
              <button
                onClick={() => f.isFolder && onOpenFolder(f)}
                className={`text-sm text-left ${f.isFolder ? 'text-brand-600 hover:underline font-medium' : 'text-slate-700'}`}
              >
                {f.isFolder ? '📁 ' : '📄 '}{f.name}
                {f.modifiedTime && (
                  <span className="text-xs text-slate-400 ml-2">
                    {new Date(f.modifiedTime).toLocaleDateString('es-CL')}
                  </span>
                )}
              </button>
              {!f.isFolder && (
                <button
                  onClick={() => onImport(f)}
                  disabled={importPending}
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
  );
}

function DuplicateDialog({ duplicate, onReplace, onKeep, onCancel }) {
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 space-y-3">
      <p className="text-sm text-amber-800">
        Ya existe <strong>{duplicate.existing.name}</strong> (subido el{' '}
        {new Date(duplicate.existing.uploadDate).toLocaleString('es-CL')}). ¿Qué desea hacer?
      </p>
      <div className="flex gap-3">
        <button onClick={onReplace} className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-medium">Reemplazar</button>
        <button onClick={onKeep}    className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">Conservar ambos</button>
        <button onClick={onCancel}  className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-sm">Cancelar</button>
      </div>
    </div>
  );
}

// ── Panel Google Drive ───────────────────────────────────────────────
function GooglePanel({ onDisconnect }) {
  const { data: status } = useCloudStatus();
  const connected = status?.connected;
  const [folderId, setFolderId] = useState('root');
  const [stack, setStack]       = useState([]);
  const [duplicate, setDuplicate] = useState(null);
  const [feedback, setFeedback]   = useState(null);
  const filesQuery = useCloudFiles(folderId, !!connected);
  const importFile = useImportCloudFile();

  async function connect() {
    try {
      const { data } = await api.get('/cloud/google/auth-url');
      window.location.href = data.url;
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'No configurado.' });
    }
  }

  async function doImport(file, onDuplicate) {
    setFeedback(null);
    try {
      const res = await importFile.mutateAsync({ fileId: file.id, location: file.location, onDuplicate });
      setDuplicate(null);
      setFeedback({ type: 'success', text: res.message });
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'DUPLICATE_NAME') { setDuplicate({ file, existing: data.existing }); return; }
      setFeedback({ type: 'error', text: data?.error || 'Error al importar.' });
    }
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm ${feedback.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {feedback.text}
        </div>
      )}
      {status?.configured === false && (
        <p className="text-sm text-slate-500">{status.message}</p>
      )}
      {status?.configured && !connected && (
        <button onClick={connect} className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-medium">
          Conectar Google Drive
        </button>
      )}
      {connected && (
        <div className="flex justify-end">
          <button onClick={() => onDisconnect('google')} className="text-xs text-slate-400 hover:text-rose-600 underline">
            Desconectar cuenta
          </button>
        </div>
      )}
      {duplicate && (
        <DuplicateDialog
          duplicate={duplicate}
          onReplace={() => doImport(duplicate.file, 'replace')}
          onKeep={() => doImport(duplicate.file, 'keep')}
          onCancel={() => setDuplicate(null)}
        />
      )}
      {connected && (
        <FileBrowser
          filesQuery={filesQuery}
          onImport={doImport}
          importPending={importFile.isPending}
          onOpenFolder={(f) => { setStack((s) => [...s, { id: folderId, name: f.name }]); setFolderId(f.id); }}
          onBack={() => { const prev = stack[stack.length - 1]; setStack((s) => s.slice(0, -1)); setFolderId(prev?.id || 'root'); }}
          stack={stack}
          folderLabel={stack.length === 0 ? 'Mi unidad' : stack.map((s) => s.name).join(' / ')}
        />
      )}
    </div>
  );
}

// ── Panel Dropbox ────────────────────────────────────────────────────
function DropboxPanel({ onDisconnect }) {
  const { data: status } = useDropboxStatus();
  const connected = status?.connected;
  const [folderPath, setFolderPath] = useState('');
  const [stack, setStack]           = useState([]);
  const [duplicate, setDuplicate]   = useState(null);
  const [feedback, setFeedback]     = useState(null);
  const filesQuery = useDropboxFiles(folderPath, !!connected);
  const importFile = useImportDropboxFile();

  async function connect() {
    try {
      const { data } = await api.get('/cloud/dropbox/auth-url');
      window.location.href = data.url;
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'No configurado.' });
    }
  }

  async function doImport(file, onDuplicate) {
    setFeedback(null);
    try {
      const res = await importFile.mutateAsync({ fileId: file.id, location: file.location, onDuplicate });
      setDuplicate(null);
      setFeedback({ type: 'success', text: res.message });
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'DUPLICATE_NAME') { setDuplicate({ file, existing: data.existing }); return; }
      setFeedback({ type: 'error', text: data?.error || 'Error al importar.' });
    }
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm ${feedback.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {feedback.text}
        </div>
      )}
      {status?.configured === false && (
        <p className="text-sm text-slate-500">{status.message}</p>
      )}
      {status?.configured && !connected && (
        <button onClick={connect} className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-medium">
          Conectar Dropbox
        </button>
      )}
      {connected && (
        <div className="flex justify-end">
          <button onClick={() => onDisconnect('dropbox')} className="text-xs text-slate-400 hover:text-rose-600 underline">
            Desconectar cuenta
          </button>
        </div>
      )}
      {duplicate && (
        <DuplicateDialog
          duplicate={duplicate}
          onReplace={() => doImport(duplicate.file, 'replace')}
          onKeep={() => doImport(duplicate.file, 'keep')}
          onCancel={() => setDuplicate(null)}
        />
      )}
      {connected && (
        <FileBrowser
          filesQuery={filesQuery}
          onImport={doImport}
          importPending={importFile.isPending}
          onOpenFolder={(f) => { setStack((s) => [...s, { path: folderPath, name: f.name }]); setFolderPath(f.id); }}
          onBack={() => { const prev = stack[stack.length - 1]; setStack((s) => s.slice(0, -1)); setFolderPath(prev?.path || ''); }}
          stack={stack}
          folderLabel={stack.length === 0 ? 'Mi Dropbox' : stack.map((s) => s.name).join(' / ')}
        />
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────
export default function CloudConnect() {
  const [params] = useSearchParams();
  const [active, setActive] = useState(
    params.get('provider') || 'google'
  );
  const disconnect = useDisconnectCloud();

  async function handleDisconnect(provider) {
    await disconnect.mutateAsync(provider);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Almacenamiento en la nube</h1>
        <p className="text-slate-500 mt-1">Importe evidencias directamente desde su nube.</p>
      </header>

      {/* Selector de proveedor */}
      <div className="flex gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              active === p.id
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Panel activo */}
      {active === 'google'  && <GooglePanel  onDisconnect={handleDisconnect} />}
      {active === 'dropbox' && <DropboxPanel onDisconnect={handleDisconnect} />}
    </div>
  );
}
