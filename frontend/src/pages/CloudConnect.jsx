import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  subiendo: 'Subiendo…',
  ok: 'Importado',
  error: 'Error',
};

const STATUS_STYLES = {
  pendiente: 'text-steel-400',
  subiendo: 'text-brand-600',
  ok: 'text-emerald-600',
  error: 'text-rose-600',
};

function useImportProgress(provider) {
  const storageKey = `qualitrack-cloud-import-${provider}`;
  const [progress, setProgress] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!saved) return { fileStatuses: new Map(), importedIds: [] };
      const entries = (saved.fileStatuses || []).map(([id, entry]) => [
        id,
        {
          ...entry,
          status: entry.status === 'subiendo' ? 'pendiente' : entry.status,
          code: entry.reason?.includes('No autenticado') ? 'NETWORK_ERROR' : entry.code,
        },
      ]);
      return { fileStatuses: new Map(entries), importedIds: saved.importedIds || [] };
    } catch {
      return { fileStatuses: new Map(), importedIds: [] };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        fileStatuses: Array.from(progress.fileStatuses.entries()),
        importedIds: progress.importedIds,
      }));
    } catch {
    }
  }, [progress, storageKey]);

  const setFileStatuses = (update) => setProgress((previous) => ({
    ...previous,
    fileStatuses: typeof update === 'function' ? update(previous.fileStatuses) : update,
  }));
  const setImportedIds = (update) => setProgress((previous) => ({
    ...previous,
    importedIds: typeof update === 'function' ? update(previous.importedIds) : update,
  }));
  return { fileStatuses: progress.fileStatuses, setFileStatuses, importedIds: progress.importedIds, setImportedIds };
}

/**
 * Clasifica el error de una importación individual para poder mostrar un
 * motivo específico (y, en el caso de error de red, permitir reintentar
 * solo ese archivo) en vez de un conteo agregado de "omitidos".
 */
function classifyImportError(err) {
  if (!err.response) {
    return { code: 'NETWORK_ERROR', reason: 'Error de conexión. Verifique su red e inténtelo nuevamente.' };
  }
  if (err.response.status === 401) {
    return { code: 'NETWORK_ERROR', reason: 'Sesión no autenticada. Inicie sesión nuevamente para reintentar.' };
  }
  const data = err.response.data;
  if (data?.retryable || data?.code === 'CLOUD_CONNECTION_ERROR') {
    return {
      code: 'CLOUD_CONNECTION_ERROR',
      reason: data.error || 'La conexión expiró. Reconecte la cuenta e inténtelo nuevamente.',
    };
  }
  if (data?.code === 'DUPLICATE_NAME') {
    return {
      code: 'DUPLICATE_NAME',
      reason: data.existing?.inTrash
        ? 'Ya existe un archivo con el mismo nombre en la papelera.'
        : 'Ya existe un archivo con el mismo nombre.',
    };
  }
  if (data?.code === 'INVALID_FORMAT') {
    return { code: 'INVALID_FORMAT', reason: data.error || 'Formato no soportado.' };
  }
  if (data?.code === 'FILE_TOO_LARGE') {
    return { code: 'FILE_TOO_LARGE', reason: data.error || 'El archivo supera el tamaño máximo.' };
  }
  return { code: 'ERROR', reason: data?.error || 'Error al importar.' };
}

function ImportSummary({ statuses, onRetryPending, onReconnect, onGoToDocuments, importedIds, busy }) {
  const entries = Array.from(statuses.values());
  if (entries.length === 0) return null;
  const hasPending = entries.some((e) =>
    e.status === 'pendiente' ||
    (e.status === 'error' && ['NETWORK_ERROR', 'CLOUD_CONNECTION_ERROR'].includes(e.code))
  );
  const hasCloudError = entries.some((e) => e.status === 'error' && e.code === 'CLOUD_CONNECTION_ERROR');

  return (
    <div className="rounded-xl border border-steel-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-steel-700">Resultado de la importación</h3>
      <ul className="divide-y divide-steel-100">
        {entries.map(({ file, status, reason }) => (
          <li key={file.id} className="py-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-steel-700">{file.name}</span>
            <span className={`shrink-0 text-xs font-medium ${STATUS_STYLES[status]}`}>
              {STATUS_LABELS[status]}
              {reason ? ` — ${reason}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3 pt-1">
        {hasCloudError && (
          <button
            onClick={onReconnect}
            disabled={busy}
            className="rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Reconectar cuenta
          </button>
        )}
        {hasPending && (
          <button
            onClick={onRetryPending}
            disabled={busy}
            className="rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Reintentar pendientes
          </button>
        )}
        {importedIds.length > 0 && (
          <button
            onClick={onGoToDocuments}
            className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-xs font-medium"
          >
            Ir a evidencias
          </button>
        )}
      </div>
    </div>
  );
}

function FileBrowser({
  filesQuery,
  onImport,
  importing,
  onOpenFolder,
  onGoBack,
  stack,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  selectMode,
  onToggleSelectMode,
  selected,
  onToggleSelect,
  onImportSelected,
  importingSelected,
}) {
  const filteredFiles = useMemo(() => {
    const all = filesQuery.data?.files || [];
    return all.filter((f) => {
      const nameMatch = f.name.toLowerCase().includes(search.toLowerCase());
      const typeMatch = matchesType(f, typeFilter);
      return nameMatch && typeMatch;
    });
  }, [filesQuery.data?.files, search, typeFilter]);

  const hasFiles = !filesQuery.isLoading && filesQuery.data?.connected !== false && !filesQuery.error;
  const selectedCount = selected.size;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {stack.length > 0 && (
            <button onClick={onGoBack} className="text-sm text-brand-600 hover:underline">
              ← Atrás
            </button>
          )}
          <span className="text-sm text-steel-500">
            {stack.length === 0 ? 'Raíz' : stack.map((s) => s.name).join(' / ')}
          </span>
        </div>
        {hasFiles && (
          <button
            onClick={onToggleSelectMode}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
              selectMode ? 'bg-steel-200 text-steel-700' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
            }`}
          >
            {selectMode ? 'Cancelar selección' : 'Seleccionar'}
          </button>
        )}
      </div>

      {/* Filtros */}
      {hasFiles && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-steel-200 px-3 py-2 text-sm text-steel-800 placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-steel-200 px-3 py-2 text-sm text-steel-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Barra de selección flotante y fija */}
      {selectMode && selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 pointer-events-none">
          <div className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-xl bg-brand-50 border border-brand-200 shadow-lg px-4 py-3">
            <span className="text-sm text-brand-800 font-medium">
              {selectedCount} archivo{selectedCount === 1 ? '' : 's'} seleccionado{selectedCount === 1 ? '' : 's'}
            </span>
            <button
              onClick={onImportSelected}
              disabled={importingSelected}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {importingSelected ? 'Importando…' : 'Importar seleccionados'}
            </button>
          </div>
        </div>
      )}

      {/* Contenido */}
      {filesQuery.isLoading ? (
        <p className="text-steel-500 text-sm">Cargando archivos…</p>
      ) : filesQuery.data?.connected === false || filesQuery.error ? (
        <p className="text-rose-600 text-sm">
          {filesQuery.data?.error || 'No fue posible establecer conexión con la cuenta seleccionada.'}
        </p>
      ) : filteredFiles.length === 0 ? (
        <p className="text-steel-500 text-sm">
          {filesQuery.data?.files?.length === 0
            ? (filesQuery.data.message || 'No existen documentos almacenados en esta ubicación.')
            : 'Ningún archivo coincide con la búsqueda.'}
        </p>
      ) : (
        <ul className="divide-y divide-steel-100">
          {filteredFiles.map((f) => (
            <li key={f.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {selectMode && !f.isFolder && (
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => onToggleSelect(f)}
                    className="h-4 w-4 rounded border-steel-300 text-brand-600 focus:ring-brand-400"
                  />
                )}
                <button
                  onClick={() => f.isFolder && onOpenFolder(f)}
                  className={`text-sm text-left truncate ${f.isFolder ? 'text-brand-600 hover:underline font-medium' : 'text-steel-700'}`}
                >
                  {f.isFolder ? '📁 ' : '📄 '}
                  {f.name}
                  {f.modifiedTime && (
                    <span className="text-xs text-steel-400 ml-2">
                      {new Date(f.modifiedTime).toLocaleDateString('es-CL')}
                    </span>
                  )}
                </button>
              </div>
              {!f.isFolder && !selectMode && (
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

      {/* Espaciador para que la última fila no quede tapada por la barra flotante */}
      {selectMode && selectedCount > 0 && <div className="h-14" aria-hidden="true" />}
    </div>
  );
}

/**
 * Resolución de duplicados al importar (mismas opciones que la carga manual):
 * reemplazar, conservar ambos o —si el existente está en la papelera— restaurarlo.
 */
function DuplicatePrompt({ duplicate, onResolve, onCancel, busy }) {
  const { file, existing } = duplicate;

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 space-y-3">
      {existing.inTrash ? (
        <p className="text-sm text-amber-800">
          Ya existe un documento llamado <strong>{existing.name}</strong>, pero está en la{' '}
          <span className="font-medium">papelera</span> (eliminado el{' '}
          {new Date(existing.deletedAt).toLocaleString('es-CL')}). Puede{' '}
          <strong>restaurarlo</strong> (no se importa <strong>{file.name}</strong>),{' '}
          <strong>reemplazarlo</strong> (se elimina definitivamente el de la papelera y se importa{' '}
          <strong>{file.name}</strong> en su lugar) o <strong>conservar ambos</strong> (el existente
          permanece en la papelera y <strong>{file.name}</strong> se importa como un documento nuevo).
        </p>
      ) : (
        <p className="text-sm text-amber-800">
          Ya existe <strong>{existing.name}</strong> en el repositorio (creado el{' '}
          {new Date(existing.creationDate).toLocaleDateString('es-CL')}, subido el{' '}
          {new Date(existing.uploadDate).toLocaleString('es-CL')}). ¿Qué desea hacer con{' '}
          <strong>{file.name}</strong>?
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {existing.inTrash && (
          <button
            onClick={() => onResolve('restore')}
            disabled={busy}
            className="btn rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors duration-150 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Restaurar el existente
          </button>
        )}
        <button
          onClick={() => onResolve('replace')}
          disabled={busy}
          className="btn rounded-lg bg-rose-600 hover:bg-rose-700 transition-colors duration-150 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Reemplazar
        </button>
        <button
          onClick={() => onResolve('keep')}
          disabled={busy}
          className="btn rounded-lg bg-brand-600 hover:bg-brand-700 transition-colors duration-150 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Conservar ambos
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="btn rounded-lg bg-steel-100 hover:bg-steel-200 transition-colors duration-150 text-steel-700 px-4 py-2 text-sm disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function GoogleDriveTab({ initialFeedback }) {
  const navigate = useNavigate();
  const { data: status, isLoading } = useCloudStatus();
  const connected = status?.connected;
  const [folderId, setFolderId] = useState('root');
  const [stack, setStack] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [feedback, setFeedback] = useState(initialFeedback);
  const [duplicate, setDuplicate] = useState(null); // { file, existing }
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Map());
  const [importingSelected, setImportingSelected] = useState(false);
  const { fileStatuses, setFileStatuses, importedIds, setImportedIds } = useImportProgress('google');
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
    setDuplicate(null);
    setSelectMode(false);
    setSelected(new Map());
  }

  function goBack() {
    const prev = stack[stack.length - 1];
    setStack((s) => s.slice(0, -1));
    setFolderId(prev ? prev.id : 'root');
    setSearch('');
    setTypeFilter('');
    setDuplicate(null);
    setSelectMode(false);
    setSelected(new Map());
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Map());
  }

  function toggleSelect(file) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.set(file.id, file);
      return next;
    });
  }

  async function doImport(file, onDuplicate) {
    setFeedback(null);
    try {
      const res = await importFile.mutateAsync({ fileId: file.id, location: file.location, onDuplicate });
      setDuplicate(null);
      setFeedback({ type: 'success', text: res.message });
      navigate('/documents', { state: { importedIds: [res.id] } });
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'DUPLICATE_NAME') { setDuplicate({ file, existing: data.existing }); return; }
      setDuplicate(null);
      setFeedback({ type: 'error', text: data?.error || 'Error al importar.' });
    }
  }

  async function runImportBatch(files, isRetry = false) {
    setFeedback(null);
    setImportingSelected(true);
    setFileStatuses((prev) => {
      const next = isRetry ? new Map(prev) : new Map();
      files.forEach((file) => next.set(file.id, { file, status: 'pendiente' }));
      return next;
    });
    if (!isRetry) setImportedIds([]);
    const newlyImported = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setFileStatuses((prev) => new Map(prev).set(file.id, { file, status: 'subiendo' }));
      try {
        const res = await importFile.mutateAsync({ fileId: file.id, location: file.location });
        newlyImported.push(res.id);
        setFileStatuses((prev) => new Map(prev).set(file.id, { file, status: 'ok' }));
      } catch (err) {
        const { code, reason } = classifyImportError(err);
        setFileStatuses((prev) => new Map(prev).set(file.id, { file, status: 'error', code, reason }));
        if (code === 'NETWORK_ERROR' || code === 'CLOUD_CONNECTION_ERROR') {
          setFileStatuses((prev) => {
            const next = new Map(prev);
            files.slice(index + 1).forEach((pendingFile) =>
              next.set(pendingFile.id, { file: pendingFile, status: 'pendiente' })
            );
            return next;
          });
          break;
        }
      }
    }
    setImportingSelected(false);
    setSelectMode(false);
    setSelected(new Map());
    if (newlyImported.length > 0) {
      setImportedIds((prev) => [...prev, ...newlyImported]);
    }
  }

  async function importSelected() {
    const files = Array.from(selected.values());
    if (files.length === 0) return;
    await runImportBatch(files);
  }

  async function retryPending() {
    if (!connected) {
      setFeedback({ type: 'error', text: 'Reconecte la cuenta antes de reintentar los pendientes.' });
      return;
    }
    const pending = Array.from(fileStatuses.values())
      .filter((e) => e.status === 'pendiente' ||
        (e.status === 'error' && ['NETWORK_ERROR', 'CLOUD_CONNECTION_ERROR'].includes(e.code)))
      .map((e) => e.file);
    if (pending.length === 0) return;
    await runImportBatch(pending, true);
  }

  function goToDocuments() {
    navigate('/documents', { state: { importedIds } });
  }

  if (isLoading) return <p className="text-steel-500">Cargando…</p>;

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm ${feedback.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {feedback.text}
        </div>
      )}

      {status?.configured === false && (
        <div className="rounded-xl bg-steel-50 border border-steel-200 p-6 space-y-3">
          <h2 className="font-semibold text-steel-800">Integración no configurada</h2>
          <p className="text-sm text-steel-600">{status.message}</p>
          <ol className="list-decimal list-inside text-sm text-steel-600 space-y-1">
            <li>Cree credenciales OAuth (tipo "Aplicación web") en Google Cloud Console.</li>
            <li>Agregue el redirect URI: <code className="bg-steel-200 px-1 rounded">http://localhost:4000/api/cloud/google/callback</code></li>
            <li>Defina <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_CLIENT_SECRET</code> en <code>.env</code> y reinicie los contenedores.</li>
          </ol>
        </div>
      )}

      {status?.configured && !connected && (
        <button onClick={connect} className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-medium">
          Conectar Google Drive
        </button>
      )}

      {duplicate && (
        <DuplicatePrompt
          duplicate={duplicate}
          busy={importFile.isPending}
          onResolve={(action) => doImport(duplicate.file, action)}
          onCancel={() => setDuplicate(null)}
        />
      )}

      <ImportSummary
        statuses={fileStatuses}
        importedIds={importedIds}
        busy={importingSelected}
        onReconnect={connect}
        onRetryPending={retryPending}
        onGoToDocuments={goToDocuments}
      />

      {connected && (
        <>
          <div className="flex justify-end">
            <button onClick={disconnect} className="text-xs text-steel-400 hover:text-rose-600">
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
            selectMode={selectMode}
            onToggleSelectMode={toggleSelectMode}
            selected={new Set(selected.keys())}
            onToggleSelect={toggleSelect}
            onImportSelected={importSelected}
            importingSelected={importingSelected}
            setTypeFilter={setTypeFilter}
          />
        </>
      )}
    </div>
  );
}

function DropboxTab({ initialFeedback }) {
  const navigate = useNavigate();
  const { data: status, isLoading } = useDropboxStatus();
  const connected = status?.connected;
  const [folderPath, setFolderPath] = useState('');
  const [stack, setStack] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [feedback, setFeedback] = useState(initialFeedback);
  const [duplicate, setDuplicate] = useState(null); // { file, existing }
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Map());
  const [importingSelected, setImportingSelected] = useState(false);
  const { fileStatuses, setFileStatuses, importedIds, setImportedIds } = useImportProgress('dropbox');
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
    setDuplicate(null);
    setSelectMode(false);
    setSelected(new Map());
  }

  function goBack() {
    const prev = stack[stack.length - 1];
    setStack((s) => s.slice(0, -1));
    setFolderPath(prev ? prev.path : '');
    setSearch('');
    setTypeFilter('');
    setDuplicate(null);
    setSelectMode(false);
    setSelected(new Map());
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Map());
  }

  function toggleSelect(file) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.set(file.id, file);
      return next;
    });
  }

  async function doImport(file, onDuplicate) {
    setFeedback(null);
    try {
      const res = await importFile.mutateAsync({ fileId: file.id, location: file.location, onDuplicate });
      setDuplicate(null);
      setFeedback({ type: 'success', text: res.message });
      navigate('/documents', { state: { importedIds: [res.id] } });
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'DUPLICATE_NAME') { setDuplicate({ file, existing: data.existing }); return; }
      setDuplicate(null);
      setFeedback({ type: 'error', text: data?.error || 'Error al importar.' });
    }
  }

  async function runImportBatch(files, isRetry = false) {
    setFeedback(null);
    setImportingSelected(true);
    setFileStatuses((prev) => {
      const next = isRetry ? new Map(prev) : new Map();
      files.forEach((file) => next.set(file.id, { file, status: 'pendiente' }));
      return next;
    });
    if (!isRetry) setImportedIds([]);
    const newlyImported = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setFileStatuses((prev) => new Map(prev).set(file.id, { file, status: 'subiendo' }));
      try {
        const res = await importFile.mutateAsync({ fileId: file.id, location: file.location });
        newlyImported.push(res.id);
        setFileStatuses((prev) => new Map(prev).set(file.id, { file, status: 'ok' }));
      } catch (err) {
        const { code, reason } = classifyImportError(err);
        setFileStatuses((prev) => new Map(prev).set(file.id, { file, status: 'error', code, reason }));
        if (code === 'NETWORK_ERROR' || code === 'CLOUD_CONNECTION_ERROR') {
          setFileStatuses((prev) => {
            const next = new Map(prev);
            files.slice(index + 1).forEach((pendingFile) =>
              next.set(pendingFile.id, { file: pendingFile, status: 'pendiente' })
            );
            return next;
          });
          break;
        }
      }
    }
    setImportingSelected(false);
    setSelectMode(false);
    setSelected(new Map());
    if (newlyImported.length > 0) {
      setImportedIds((prev) => [...prev, ...newlyImported]);
    }
  }

  async function importSelected() {
    const files = Array.from(selected.values());
    if (files.length === 0) return;
    await runImportBatch(files);
  }

  async function retryPending() {
    if (!connected) {
      setFeedback({ type: 'error', text: 'Reconecte la cuenta antes de reintentar los pendientes.' });
      return;
    }
    const pending = Array.from(fileStatuses.values())
      .filter((e) => e.status === 'pendiente' ||
        (e.status === 'error' && ['NETWORK_ERROR', 'CLOUD_CONNECTION_ERROR'].includes(e.code)))
      .map((e) => e.file);
    if (pending.length === 0) return;
    await runImportBatch(pending, true);
  }

  function goToDocuments() {
    navigate('/documents', { state: { importedIds } });
  }

  if (isLoading) return <p className="text-steel-500">Cargando…</p>;

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm ${feedback.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {feedback.text}
        </div>
      )}

      {status?.configured === false && (
        <div className="rounded-xl bg-steel-50 border border-steel-200 p-6 space-y-3">
          <h2 className="font-semibold text-steel-800">Integración no configurada</h2>
          <p className="text-sm text-steel-600">{status.message}</p>
          <ol className="list-decimal list-inside text-sm text-steel-600 space-y-1">
            <li>Cree una app en <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer" className="text-brand-600 underline">Dropbox Developer Console</a>.</li>
            <li>Agregue el redirect URI: <code className="bg-steel-200 px-1 rounded">http://localhost:4000/api/cloud/dropbox/callback</code></li>
            <li>Defina <code>DROPBOX_APP_KEY</code> y <code>DROPBOX_APP_SECRET</code> en <code>.env</code> y reinicie los contenedores.</li>
          </ol>
        </div>
      )}

      {status?.configured && !connected && (
        <button onClick={connect} className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-medium">
          Conectar Dropbox
        </button>
      )}

      {duplicate && (
        <DuplicatePrompt
          duplicate={duplicate}
          busy={importFile.isPending}
          onResolve={(action) => doImport(duplicate.file, action)}
          onCancel={() => setDuplicate(null)}
        />
      )}

      <ImportSummary
        statuses={fileStatuses}
        importedIds={importedIds}
        busy={importingSelected}
        onReconnect={connect}
        onRetryPending={retryPending}
        onGoToDocuments={goToDocuments}
      />

      {connected && (
        <>
          <div className="flex justify-end">
            <button onClick={disconnect} className="text-xs text-steel-400 hover:text-rose-600">
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
            selectMode={selectMode}
            onToggleSelectMode={toggleSelectMode}
            selected={new Set(selected.keys())}
            onToggleSelect={toggleSelect}
            onImportSelected={importSelected}
            importingSelected={importingSelected}
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
        <p className="text-steel-500 mt-1">
          Importe evidencias directamente desde su almacenamiento en la nube.
        </p>
      </header>

      {/* Tabs */}
      <div className="border-b border-steel-200">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-steel-500 hover:text-steel-700'
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
