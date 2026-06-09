import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import {
  useCloudStatus,
  useCloudFiles,
  useImportCloudFile,
  useDropboxStatus,
  useDropboxFiles,
  useImportDropboxFile,
} from '../hooks/useApi.js';

const TYPE_OPTIONS = [
  { label: 'Todos', value: '' },
  { label: 'PDF', value: 'pdf' },
  { label: 'Word (DOCX)', value: 'docx' },
  { label: 'Excel (XLSX)', value: 'xlsx' },
  { label: 'Carpeta', value: 'folder' },
];

function matchesType(file, typeFilter) {
  if (!typeFilter) return true;
  if (typeFilter === 'folder') return file.isFolder;
  const mime = file.mimeType?.toLowerCase() || '';
  const name = file.name?.toLowerCase() || '';
  if (typeFilter === 'pdf') return mime.includes('pdf') || name.endsWith('.pdf');
  if (typeFilter === 'docx')
    return mime.includes('wordprocessingml') || mime.includes('msword') || name.endsWith('.docx') || name.endsWith('.doc');
  if (typeFilter === 'xlsx')
    return mime.includes('spreadsheetml') || mime.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls');
  return true;
}

function FileBrowser({ filesQuery, onImport, importing, onOpenFolder, onGoBack, stack, search, setSearch, typeFilter, setTypeFilter }) {
  const filteredFiles = useMemo(() => {
    const all = filesQuery.data?.files || [];
    return all.filter((f) => {
      const nameMatch = f.name.toLowerCase().includes(search.toLowerCase());
      const typeMatch = matchesType(f, typeFilter);
      return nameMatch && typeMatch;
    });
  }, [filesQuery.data?.files, search, typeFilter]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        {stack.length > 0 && (
          <button onClick={onGoBack} className="text-sm text-brand-600 hover:underline">
            ← Atrás
          </button>
        )}
        <span className="text-sm text-slate-500">
          {stack.length === 0 ? 'Raíz' : stack.map((s) => s.name).join(' / ')}
        </span>
      </div>

      {/* Filtros */}
      {!filesQuery.isLoading && filesQuery.data?.connected !== false && !filesQuery.error && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Contenido */}
      {filesQuery.isLoading ? (
        <p className="text-slate-500 text-sm">Cargando archivos…</p>
      ) : filesQuery.data?.connected === false || filesQuery.error ? (
        <p className="text-rose-600 text-sm">
          {filesQuery.data?.error || 'No fue posible establecer conexión con la cuenta seleccionada.'}
        </p>
      ) : filteredFiles.length === 0 ? (
        <p className="text-slate-500 text-sm">
          {filesQuery.data?.files?.length === 0
            ? (filesQuery.data.message || 'No existen documentos almacenados en esta ubicación.')
            : 'Ningún archivo coincide con la búsqueda.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filteredFiles.map((f) => (
            <li key={f.id} className="py-2.5 flex items-center justify-between gap-3">
              <button
                onClick={() => f.isFolder && onOpenFolder(f)}
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
                  onClick={() => onImport(f)}
                  disabled={importing}
                  className="rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 px-3 py-1 text-xs font-medium disabled:opacity-50"
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

function GoogleDriveTab({ initialFeedback }) {
  const { data: status, isLoading } = useCloudStatus();
  const connected = status?.connected;
  const [folderId, setFolderId] = useState('root');
  const [stack, setStack] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [feedback, setFeedback] = useState(initialFeedback);
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

  async function disconnect() {
    try {
      await api.delete('/cloud/google/disconnect');
      setFeedback({ type: 'success', text: 'Google Drive desconectado.' });
      window.location.reload();
    } catch {
      setFeedback({ type: 'error', text: 'Error al desconectar.' });
    }
  }

  function openFolder(file) {
    setStack((s) => [...s, { id: folderId, name: file.name }]);
    setFolderId(file.id);
    setSearch('');
    setTypeFilter('');
  }

  function goBack() {
    const prev = stack[stack.length - 1];
    setStack((s) => s.slice(0, -1));
    setFolderId(prev ? prev.id : 'root');
    setSearch('');
    setTypeFilter('');
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
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm ${feedback.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {feedback.text}
        </div>
      )}

      {status?.configured === false && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 space-y-3">
          <h2 className="font-semibold text-slate-800">Integración no configurada</h2>
          <p className="text-sm text-slate-600">{status.message}</p>
          <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
            <li>Cree credenciales OAuth (tipo "Aplicación web") en Google Cloud Console.</li>
            <li>Agregue el redirect URI: <code className="bg-slate-200 px-1 rounded">http://localhost:4000/api/cloud/google/callback</code></li>
            <li>Defina <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_CLIENT_SECRET</code> en <code>.env</code> y reinicie los contenedores.</li>
          </ol>
        </div>
      )}

      {status?.configured && !connected && (
        <button onClick={connect} className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-medium">
          Conectar Google Drive
        </button>
      )}

      {connected && (
        <>
          <div className="flex justify-end">
            <button onClick={disconnect} className="text-xs text-slate-400 hover:text-rose-600">
              Desconectar cuenta
            </button>
          </div>
          <FileBrowser
            filesQuery={filesQuery}
            onImport={doImport}
            importing={importFile.isPending}
            onOpenFolder={openFolder}
            onGoBack={goBack}
            stack={stack}
            search={search}
            setSearch={setSearch}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
          />
        </>
      )}
    </div>
  );
}

function DropboxTab({ initialFeedback }) {
  const { data: status, isLoading } = useDropboxStatus();
  const connected = status?.connected;
  const [folderPath, setFolderPath] = useState('');
  const [stack, setStack] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [feedback, setFeedback] = useState(initialFeedback);
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

  async function disconnect() {
    try {
      await api.delete('/cloud/dropbox/disconnect');
      setFeedback({ type: 'success', text: 'Dropbox desconectado.' });
      window.location.reload();
    } catch {
      setFeedback({ type: 'error', text: 'Error al desconectar.' });
    }
  }

  function openFolder(file) {
    setStack((s) => [...s, { path: folderPath, name: file.name }]);
    setFolderPath(file.id);
    setSearch('');
    setTypeFilter('');
  }

  function goBack() {
    const prev = stack[stack.length - 1];
    setStack((s) => s.slice(0, -1));
    setFolderPath(prev ? prev.path : '');
    setSearch('');
    setTypeFilter('');
  }

  async function doImport(file) {
    setFeedback(null);
    try {
      const res = await importFile.mutateAsync({ fileId: file.id, location: file.location });
      setFeedback({ type: 'success', text: res.message });
    } catch (err) {
      const data = err.response?.data;
      setFeedback({ type: 'error', text: data?.error || 'Error al importar.' });
    }
  }

  if (isLoading) return <p className="text-slate-500">Cargando…</p>;

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm ${feedback.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {feedback.text}
        </div>
      )}

      {status?.configured === false && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 space-y-3">
          <h2 className="font-semibold text-slate-800">Integración no configurada</h2>
          <p className="text-sm text-slate-600">{status.message}</p>
          <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
            <li>Cree una app en <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer" className="text-brand-600 underline">Dropbox Developer Console</a>.</li>
            <li>Agregue el redirect URI: <code className="bg-slate-200 px-1 rounded">http://localhost:4000/api/cloud/dropbox/callback</code></li>
            <li>Defina <code>DROPBOX_APP_KEY</code> y <code>DROPBOX_APP_SECRET</code> en <code>.env</code> y reinicie los contenedores.</li>
          </ol>
        </div>
      )}

      {status?.configured && !connected && (
        <button onClick={connect} className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-medium">
          Conectar Dropbox
        </button>
      )}

      {connected && (
        <>
          <div className="flex justify-end">
            <button onClick={disconnect} className="text-xs text-slate-400 hover:text-rose-600">
              Desconectar cuenta
            </button>
          </div>
          <FileBrowser
            filesQuery={filesQuery}
            onImport={doImport}
            importing={importFile.isPending}
            onOpenFolder={openFolder}
            onGoBack={goBack}
            stack={stack}
            search={search}
            setSearch={setSearch}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
          />
        </>
      )}
    </div>
  );
}

const TABS = [
  { id: 'google', label: 'Google Drive', icon: '🔵' },
  { id: 'dropbox', label: 'Dropbox', icon: '📦' },
];

export default function CloudConnect() {
  const [params] = useSearchParams();

  const initialProvider = params.get('provider') === 'dropbox' ? 'dropbox' : 'google';
  const [activeTab, setActiveTab] = useState(initialProvider);

  const googleFeedback =
    activeTab === 'google' && params.get('provider') !== 'dropbox'
      ? params.get('connected') === '1'
        ? { type: 'success', text: 'Cuenta de Google Drive conectada.' }
        : params.get('connected') === '0'
        ? { type: 'error', text: 'No fue posible conectar Google Drive.' }
        : null
      : null;

  const dropboxFeedback =
    params.get('provider') === 'dropbox'
      ? params.get('connected') === '1'
        ? { type: 'success', text: 'Cuenta de Dropbox conectada.' }
        : params.get('connected') === '0'
        ? { type: 'error', text: 'No fue posible conectar Dropbox.' }
        : null
      : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
          Almacenamiento en la nube
        </h1>
        <p className="text-slate-500 mt-1">
          Importe evidencias directamente desde su almacenamiento en la nube.
        </p>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido del tab activo */}
      {activeTab === 'google' && <GoogleDriveTab initialFeedback={googleFeedback} />}
      {activeTab === 'dropbox' && <DropboxTab initialFeedback={dropboxFeedback} />}
    </div>
  );
}
