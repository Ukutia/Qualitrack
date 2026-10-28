import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SelectionCheckbox from '../components/SelectionCheckbox.jsx';
import { DocumentThumbnail } from '../components/DocumentPreview.jsx';
import NavigationIcon from '../components/NavigationIcon.jsx';
import ReadOnlyNotice from '../components/ReadOnlyNotice.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePermission } from '../hooks/usePermission.js';
import {
  useCreateFolder,
  useDeleteFolder,
  useDocumentFilterOptions,
  useDocuments,
  useFolderExplorer,
  useMoveDocuments,
  useMoveFolder,
  useRenameDocument,
  useRenameFolder,
  useTrashDocument,
  useTrashRepositoryItems,
} from '../hooks/useApi.js';
import { ANALYSIS_LABELS, normalizeAnalysisStatus } from '../lib/analysisStatus.js';
import { MODULES } from '../lib/permissions.js';

const COLORS = {
  blue: 'bg-blue-500', green: 'bg-emerald-500', yellow: 'bg-amber-400', orange: 'bg-orange-500',
  red: 'bg-rose-500', purple: 'bg-violet-500', pink: 'bg-pink-500', gray: 'bg-steel-500',
};
const FOLDER_ICON_COLORS = {
  blue: 'text-blue-500', green: 'text-emerald-500', yellow: 'text-amber-400', orange: 'text-orange-500',
  red: 'text-rose-500', purple: 'text-violet-500', pink: 'text-pink-500', gray: 'text-steel-500',
};
const COLOR_LABELS = { blue: 'Azul', green: 'Verde', yellow: 'Amarillo', orange: 'Naranjo', red: 'Rojo', purple: 'Morado', pink: 'Rosado', gray: 'Gris' };
const STATUS_STYLE = {
  Validada: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  Propuesta: 'bg-amber-100 text-amber-700 ring-amber-200',
  Descartada: 'bg-steel-200 text-steel-600 ring-steel-300',
  'Sin clasificar': 'bg-steel-100 text-steel-500 ring-steel-200',
};
const fmtSize = (bytes) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
const sourceLabel = (source) => ({ GOOGLE_DRIVE: 'Google Drive', DROPBOX: 'Dropbox', UPLOAD: 'Carga directa' }[source] || '—');
const emptyFilters = () => ({ text: '', sources: [], uploaders: [], subcriteria: [], associationStatuses: [] });
const hasFilters = (filters) => Boolean(filters.text.trim() || filters.sources.length || filters.uploaders.length || filters.subcriteria.length || filters.associationStatuses.length);
const apiError = (error) => error?.response?.data || { error: 'No se pudo completar la operación.' };

function ExtensionIcon({ format, className = '' }) {
  const extension = String(format || '').toLowerCase();
  const color = extension === 'pdf' ? 'bg-rose-100 text-rose-700' : ['doc', 'docx'].includes(extension)
    ? 'bg-blue-100 text-blue-700' : ['xls', 'xlsx'].includes(extension)
      ? 'bg-emerald-100 text-emerald-700' : 'bg-steel-100 text-steel-700';
  return <span className={`inline-grid place-items-center rounded-md px-1.5 py-1 text-[10px] font-bold uppercase ${color} ${className}`}>{extension || 'archivo'}</span>;
}

function FolderIcon({ color, className = 'h-8 w-8' }) {
  return <NavigationIcon name="/documents" className={`${className} ${FOLDER_ICON_COLORS[color] || FOLDER_ICON_COLORS.gray}`} />;
}

function TrashIconButton({ document, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Mover ${document.name} a papelera`}
      title="Mover a papelera"
      className="inline-grid h-9 w-9 place-items-center rounded-md text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <NavigationIcon name="/trash" className="h-4 w-4" />
    </button>
  );
}

function ViewToggle({ value, onChange }) {
  return (
    <div className="inline-flex items-center gap-4" role="group" aria-label="Forma de visualizar">
      {[
        ['list', 'Lista', 'M4 6h16M4 12h16M4 18h16'],
        ['grid', 'Mosaico', 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z'],
      ].map(([mode, label, path]) => (
        <button key={mode} type="button" onClick={() => onChange(mode)} aria-pressed={value === mode}
          className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-1 py-2 text-sm font-medium ${value === mode ? 'border-brand-600 text-brand-700' : 'border-transparent text-steel-600'}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={path} strokeLinecap="round" strokeLinejoin="round" /></svg>
          {label}
        </button>
      ))}
    </div>
  );
}

function FilterChoices({ legend, options = [], selected, onToggle }) {
  return (
    <fieldset className="rounded-lg border border-steel-200 bg-steel-50/50 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-steel-600">{legend}</legend>
      <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
        {options.length ? options.map((option) => (
          <label key={option.value} className="flex cursor-pointer gap-2 rounded-md px-2 py-1.5 text-sm text-steel-700 hover:bg-white">
            <input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => onToggle(option.value, event.target.checked)} className="repository-checkbox mt-0.5" />
            <span>{option.label}</span>
          </label>
        )) : <p className="px-2 py-1 text-xs text-steel-500">Sin opciones disponibles.</p>}
      </div>
    </fieldset>
  );
}

function CreateFolderModal({ open, count, parentName, onClose, onCreate, pending }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  useEffect(() => { if (open) { setName(''); setColor('blue'); } }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/45 p-4" role="dialog" aria-modal="true" aria-labelledby="create-folder-title">
      <form onSubmit={(event) => { event.preventDefault(); onCreate({ name, color }); }} className="w-full max-w-md rounded-xl2 bg-white p-6 shadow-xl">
        <h2 id="create-folder-title" className="font-display text-xl font-semibold text-ink-900">Crear carpeta</h2>
        <p className="mt-1 text-sm text-steel-500">Se moverán {count} archivo(s) desde {parentName || 'Repositorio'}.</p>
        <label className="mt-5 block text-sm font-medium text-ink-900">Nombre
          <input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-steel-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </label>
        <fieldset className="mt-4"><legend className="text-sm font-medium text-ink-900">Color</legend>
          <div className="mt-2 grid grid-cols-4 gap-2">{Object.keys(COLORS).map((value) => (
            <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs ${color === value ? 'border-brand-500 ring-2 ring-brand-100' : 'border-steel-200'}`}>
              <input type="radio" name="folder-color" value={value} checked={color === value} onChange={() => setColor(value)} className="sr-only" />
              <span className={`h-3 w-3 rounded-full ${COLORS[value]}`} />{COLOR_LABELS[value]}
            </label>
          ))}</div>
        </fieldset>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-steel-200 px-4 py-2 text-sm text-steel-700">Cancelar</button>
          <button type="submit" disabled={pending || !name.trim()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Creando…' : 'Crear carpeta'}</button>
        </div>
      </form>
    </div>
  );
}

function DeleteFolderModal({ folder, onClose, onDelete, pending }) {
  if (!folder) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/45 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-folder-title">
      <div className="w-full max-w-lg rounded-xl2 bg-white p-6 shadow-xl">
        <h2 id="delete-folder-title" className="font-display text-xl font-semibold text-ink-900">Eliminar “{folder.name}”</h2>
        <p className="mt-2 text-sm text-steel-600">La acción incluye todas sus subcarpetas. Elige qué debe ocurrir con los documentos.</p>
        <div className="mt-5 grid gap-3">
          <button disabled={pending} onClick={() => onDelete('keep')} className="rounded-lg border border-steel-200 p-4 text-left hover:bg-steel-50 disabled:opacity-50"><span className="block font-medium text-ink-900">Eliminar solo la agrupación</span><span className="mt-1 block text-xs text-steel-500">Los archivos suben al nivel actual; los nombres repetidos se renombran automáticamente.</span></button>
          <button disabled={pending} onClick={() => onDelete('trash')} className="rounded-lg border border-rose-200 p-4 text-left hover:bg-rose-50 disabled:opacity-50"><span className="block font-medium text-rose-700">Eliminar carpeta y enviar archivos a papelera</span><span className="mt-1 block text-xs text-steel-500">No es posible si algún documento todavía está en proceso.</span></button>
        </div>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg border border-steel-200 px-4 py-2 text-sm text-steel-700">Cancelar</button>
      </div>
    </div>
  );
}

function MessageModal({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-900/45 p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl2 bg-white p-6 shadow-xl">
        <h2 className="font-display text-lg font-semibold text-ink-900">{message.title || 'No se pudo completar la operación'}</h2>
        <p className="mt-2 text-sm text-steel-600">{message.text}</p>
        {message.items?.length > 0 && <ul className="mt-3 max-h-44 list-disc overflow-auto pl-5 text-sm text-steel-600">{message.items.map((item) => <li key={item}>{item}</li>)}</ul>}
        <button autoFocus type="button" onClick={onClose} className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Entendido</button>
      </div>
    </div>
  );
}

export default function Documents() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const cacheKey = (name) => `qualitrack:${user?.id || 'anonymous'}:repository:${name}`;
  const [repositoryMode, setRepositoryMode] = useState(() => localStorage.getItem(cacheKey('mode')) || 'all');
  const [sortMode, setSortMode] = useState(() => localStorage.getItem(cacheKey('sort')) || 'recent');
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState(new Set());
  const [highlightedIds] = useState(() => new Set(location.state?.importedIds || []));
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null);
  const [message, setMessage] = useState(null);
  const [menu, setMenu] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const allQuery = useDocuments(appliedFilters);
  const folderQuery = useFolderExplorer(currentFolderId, appliedFilters, repositoryMode === 'folders');
  const { data: filterOptions = {}, isError: filterOptionsError } = useDocumentFilterOptions();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const renameDocument = useRenameDocument();
  const moveDocuments = useMoveDocuments();
  const moveFolder = useMoveFolder();
  const deleteFolder = useDeleteFolder();
  const trash = useTrashDocument();
  const trashRepositoryItems = useTrashRepositoryItems();
  const { canWrite } = usePermission(MODULES.REPOSITORIO);
  const canUpload = usePermission(MODULES.CARGA).canWrite;

  const explorer = folderQuery.data || { folders: [], documents: [], breadcrumbs: [], currentFolder: null };
  const rawDocuments = repositoryMode === 'all' ? (allQuery.data || []) : explorer.documents;
  const folders = useMemo(() => [...(explorer.folders || [])].sort((a, b) => sortMode === 'name'
    ? a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) : new Date(b.createdAt) - new Date(a.createdAt)), [explorer.folders, sortMode]);
  const documents = useMemo(() => Array.from(new Map(rawDocuments.map((document) => [document.id, document])).values()).sort((a, b) => sortMode === 'name'
    ? a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) : new Date(b.uploadedAt) - new Date(a.uploadedAt)), [rawDocuments, sortMode]);
  const isLoading = repositoryMode === 'all' ? allQuery.isLoading : folderQuery.isLoading;
  const isError = repositoryMode === 'all' ? allQuery.isError : folderQuery.isError;
  const directDocuments = documents.filter((document) => repositoryMode === 'folders' && document.folderId === currentFolderId);
  const canEditDocument = (document) => canWrite && (user?.role === 'admin' || document.uploadedById === user?.id);
  const selectableIds = (repositoryMode === 'folders' ? directDocuments : documents).filter((document) => canEditDocument(document) && document.vectorizationStatus !== 'PROCESSING').map((document) => document.id);
  const selectableFolderIds = folders.filter((folder) => canWrite && folder.canManage).map((folder) => folder.id);
  const selectableCount = selectableIds.length + selectableFolderIds.length;
  const allSelected = selectableCount > 0 && selectableIds.every((id) => selectedIds.has(id)) && selectableFolderIds.every((id) => selectedFolderIds.has(id));
  const selectionCount = selectedIds.size + selectedFolderIds.size;
  const filtersAreApplied = hasFilters(appliedFilters);
  const selectedFilterCount = draftFilters.sources.length + draftFilters.uploaders.length + draftFilters.subcriteria.length + draftFilters.associationStatuses.length;
  const currentCanManage = canWrite && (!explorer.currentFolder || explorer.currentFolder.canManage);

  useEffect(() => {
    if (location.state?.importedIds) navigate(location.pathname, { replace: true, state: null });
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) localStorage.setItem(cacheKey('mode'), repositoryMode); }, [repositoryMode, user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) localStorage.setItem(cacheKey('sort'), sortMode); }, [sortMode, user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelectedIds(new Set()); setSelectedFolderIds(new Set()); setMenu(null); }, [repositoryMode, currentFolderId, appliedFilters]);

  const reportError = (error, title) => {
    const data = apiError(error);
    setMessage({ title, text: data.error, items: data.documents?.map((item) => item.name) || data.folders?.map((item) => item.name) });
  };
  const mutateWithEmptyConfirmation = async (mutation, payload) => {
    try { return await mutation.mutateAsync(payload); }
    catch (error) {
      const data = apiError(error);
      if (data.code !== 'FOLDER_WILL_BE_DELETED') throw error;
      const names = (data.folders || [data.folder]).filter(Boolean).map((folder) => `“${folder.name}”`).join(', ');
      if (!confirm(`${data.error}${names ? `\n\nSe eliminará: ${names}.` : ''}\n\n¿Deseas continuar?`)) return null;
      return mutation.mutateAsync({ ...payload, confirmEmptyFolder: true });
    }
  };
  const openMenu = (event, type, item) => {
    event.preventDefault(); event.stopPropagation();
    const x = event.clientX || event.currentTarget.getBoundingClientRect().right;
    const y = event.clientY || event.currentTarget.getBoundingClientRect().bottom;
    setMenu({ type, item, x: Math.min(x, window.innerWidth - 250), y: Math.min(y, window.innerHeight - 280) });
  };
  const toggleSelect = (id) => setSelectedIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleFolderSelect = (id) => setSelectedFolderIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const clearSelection = () => { setSelectedIds(new Set()); setSelectedFolderIds(new Set()); };
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
    setSelectedFolderIds(allSelected ? new Set() : new Set(selectableFolderIds));
  };
  const toggleFilter = (group, value, checked) => {
    const update = (current) => ({ ...current, [group]: checked ? [...current[group], value].sort() : current[group].filter((item) => item !== value) });
    setDraftFilters(update); setAppliedFilters(update);
  };
  const clearFilters = () => { setDraftFilters(emptyFilters()); setAppliedFilters(emptyFilters()); };

  async function handleTrash(document) {
    if (!confirm(`¿Mover “${document.name}” a la papelera?`)) return;
    try { await mutateWithEmptyConfirmation(trash, { id: document.id }); }
    catch (error) { reportError(error, 'No se pudo mover el archivo'); }
  }
  async function handleTrashSelected() {
    if (!selectionCount || !confirm(`¿Mover a la papelera ${selectedIds.size} documento(s) y eliminar ${selectedFolderIds.size} carpeta(s) con todo su contenido?`)) return;
    try {
      await trashRepositoryItems.mutateAsync({ documentIds: [...selectedIds], folderIds: [...selectedFolderIds] });
      clearSelection();
    } catch (error) { reportError(error, 'No se pudo completar la eliminación masiva'); }
  }
  async function handleCreateFolder({ name, color }) {
    try { await createFolder.mutateAsync({ name, color, parentId: currentFolderId, documentIds: [...selectedIds] }); setCreateOpen(false); clearSelection(); }
    catch (error) { reportError(error, 'No se pudo crear la carpeta'); }
  }
  async function saveRename() {
    try {
      if (renaming.type === 'folder') await renameFolder.mutateAsync({ id: renaming.id, name: renameValue });
      else await renameDocument.mutateAsync({ id: renaming.id, name: renameValue });
      setRenaming(null);
    } catch (error) { reportError(error, 'No se pudo cambiar el nombre'); }
  }
  async function handleMoveDocuments(targetFolderId, ids = [...selectedIds]) {
    try { await mutateWithEmptyConfirmation(moveDocuments, { documentIds: ids, sourceFolderId: currentFolderId, targetFolderId }); setSelectedIds(new Set()); setMenu(null); }
    catch (error) { reportError(error, 'No se pudieron mover los archivos'); }
  }
  async function handleMoveFolder(folder, targetParentId) {
    try { await mutateWithEmptyConfirmation(moveFolder, { id: folder.id, targetParentId }); setMenu(null); }
    catch (error) { reportError(error, 'No se pudo mover la carpeta'); }
  }
  async function handleDeleteFolder(mode) {
    try {
      const result = await deleteFolder.mutateAsync({ id: deleteFolderTarget.id, mode });
      setDeleteFolderTarget(null);
      if (result.renamedDocuments?.length) setMessage({ title: 'Carpeta eliminada', text: 'Se conservaron los archivos y se renombraron los que chocaban en el destino.', items: result.renamedDocuments.map((item) => item.name) });
    } catch (error) { reportError(error, 'No se pudo eliminar la carpeta'); }
  }

  const parentTarget = explorer.currentFolder?.parentId ?? null;
  const beginRename = (type, item) => { setRenaming({ type, id: item.id }); setRenameValue(item.name); setMenu(null); };
  const renderRename = (type, item) => renaming?.type === type && renaming.id === item.id ? (
    <form onSubmit={(event) => { event.preventDefault(); saveRename(); }} className="flex min-w-0 gap-1" onClick={(event) => event.stopPropagation()}>
      <input autoFocus maxLength={type === 'folder' ? 100 : 255} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="min-w-0 flex-1 rounded border border-brand-400 px-2 py-1 text-sm" />
      <button className="rounded bg-brand-600 px-2 text-xs text-white">Guardar</button><button type="button" onClick={() => setRenaming(null)} className="rounded border border-steel-200 px-2 text-xs">×</button>
    </form>
  ) : null;

  const itemMenu = menu && (
    <div onClick={(event) => event.stopPropagation()} className="fixed z-40 w-60 rounded-lg border border-steel-200 bg-white p-1.5 text-sm shadow-xl" style={{ left: menu.x, top: menu.y }}>
      {(menu.type === 'folder' ? canWrite && menu.item.canManage : canEditDocument(menu.item)) ? <>
        <button type="button" onClick={() => beginRename(menu.type, menu.item)} className="w-full rounded-md px-3 py-2 text-left hover:bg-steel-50">Renombrar</button>
        {repositoryMode === 'folders' && <div className="border-t border-steel-100 pt-1"><p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-steel-400">Mover</p>
          {menu.type === 'document' ? <>
            {currentFolderId != null && <button type="button" onClick={() => handleMoveDocuments(parentTarget, [menu.item.id])} className="w-full rounded-md px-3 py-2 text-left hover:bg-steel-50">↰ {parentTarget == null ? 'Repositorio' : 'Nivel superior'}</button>}
            {folders.map((folder) => <button key={folder.id} type="button" onClick={() => handleMoveDocuments(folder.id, [menu.item.id])} className="w-full rounded-md px-3 py-2 text-left hover:bg-steel-50">↳ {folder.name}</button>)}
          </> : <>
            {currentFolderId != null && <button type="button" onClick={() => handleMoveFolder(menu.item, parentTarget)} className="w-full rounded-md px-3 py-2 text-left hover:bg-steel-50">↰ {parentTarget == null ? 'Repositorio' : 'Nivel superior'}</button>}
            {folders.filter((folder) => folder.id !== menu.item.id).map((folder) => <button key={folder.id} type="button" onClick={() => handleMoveFolder(menu.item, folder.id)} className="w-full rounded-md px-3 py-2 text-left hover:bg-steel-50">↳ Dentro de {folder.name}</button>)}
          </>}
        </div>}
        <button type="button" onClick={() => { setMenu(null); menu.type === 'folder' ? setDeleteFolderTarget(menu.item) : handleTrash(menu.item); }} className="mt-1 w-full rounded-md px-3 py-2 text-left text-rose-700 hover:bg-rose-50">Eliminar</button>
      </> : <p className="px-3 py-2 text-xs text-steel-500">No tienes permisos para modificar este elemento.</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Repositorio de evidencias</h1><p className="mt-1 text-steel-500">Organiza y revisa los documentos del Criterio 9.</p></div><div className="flex gap-3"><Link to="/trash" className="rounded-lg border border-steel-200 px-4 py-2.5 text-sm font-medium text-steel-600 hover:bg-steel-50">Papelera</Link>{canUpload && <Link to="/upload" className="btn rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white">Cargar evidencia</Link>}</div></header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 bg-white p-4 shadow-soft ring-1 ring-steel-200/60"><div className="inline-flex rounded-lg bg-steel-100 p-1" role="group" aria-label="Organización del repositorio"><button type="button" onClick={() => { setRepositoryMode('all'); setCurrentFolderId(null); }} aria-pressed={repositoryMode === 'all'} className={`rounded-md px-4 py-2 text-sm font-medium ${repositoryMode === 'all' ? 'bg-white text-brand-700 shadow-sm' : 'text-steel-600'}`}>Todos los archivos</button><button type="button" onClick={() => setRepositoryMode('folders')} aria-pressed={repositoryMode === 'folders'} className={`rounded-md px-4 py-2 text-sm font-medium ${repositoryMode === 'folders' ? 'bg-white text-brand-700 shadow-sm' : 'text-steel-600'}`}>Carpetas</button></div><div className="flex items-center gap-4"><label className="text-sm text-steel-600">Ordenar <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} className="ml-2 rounded-lg border border-steel-200 px-2 py-2 text-sm"><option value="recent">Más recientes</option><option value="name">Nombre A–Z</option></select></label><ViewToggle value={viewMode} onChange={setViewMode} /></div></div>

      {repositoryMode === 'folders' && <div className="flex flex-wrap items-center justify-between gap-3"><nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Ruta de carpetas"><button type="button" onClick={() => setCurrentFolderId(null)} className="font-medium text-brand-700 hover:underline">Repositorio</button>{explorer.breadcrumbs?.map((crumb) => <span key={crumb.id} className="flex items-center gap-1"><span className="text-steel-400">/</span><button type="button" onClick={() => setCurrentFolderId(crumb.id)} className="text-brand-700 hover:underline">{crumb.name}</button></span>)}</nav><span title={selectedFolderIds.size ? 'Deselecciona las carpetas para crear una agrupación con archivos' : !selectedIds.size ? 'Debes seleccionar al menos 1 archivo para crear la carpeta' : !currentCanManage ? 'Solo el creador o un administrador puede crear subcarpetas aquí' : undefined}><button type="button" onClick={() => setCreateOpen(true)} disabled={!selectedIds.size || selectedFolderIds.size > 0 || !currentCanManage} className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45">Crear carpeta</button></span></div>}

      <form onSubmit={(event) => { event.preventDefault(); setAppliedFilters({ ...draftFilters, text: draftFilters.text.trim() }); }} className="space-y-4 rounded-xl2 bg-white p-5 shadow-soft ring-1 ring-steel-200/60" aria-label="Buscar y filtrar evidencias"><label htmlFor="document-search" className="text-sm font-medium text-ink-900">Nombre del archivo o carpeta</label><div className="flex flex-col gap-2 sm:flex-row"><input id="document-search" type="search" maxLength={200} value={draftFilters.text} onChange={(event) => setDraftFilters((current) => ({ ...current, text: event.target.value }))} placeholder="Buscar por nombre completo o parcial" className="min-w-0 flex-1 rounded-lg border border-steel-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /><button type="submit" className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white">Buscar</button><button type="button" onClick={clearFilters} disabled={!hasFilters(draftFilters) && !filtersAreApplied} className="rounded-lg border border-steel-200 px-4 py-2.5 text-sm text-steel-600 disabled:opacity-50">Limpiar filtros</button></div><div className="flex items-center justify-between border-t border-steel-100 pt-3"><p className="text-xs text-steel-500">Los filtros se aplican al instante y se combinan entre sí.</p><button type="button" onClick={() => setFiltersVisible((value) => !value)} aria-expanded={filtersVisible} className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">{filtersVisible ? 'Ocultar filtros' : 'Filtrar'}{selectedFilterCount ? ` (${selectedFilterCount})` : ''}</button></div>{filtersVisible && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><FilterChoices legend="Fuente" options={filterOptions.sources} selected={draftFilters.sources} onToggle={(value, checked) => toggleFilter('sources', value, checked)} /><FilterChoices legend="Cargado por" options={filterOptions.uploaders} selected={draftFilters.uploaders} onToggle={(value, checked) => toggleFilter('uploaders', value, checked)} /><FilterChoices legend="Subcriterio" options={filterOptions.subcriteria} selected={draftFilters.subcriteria} onToggle={(value, checked) => toggleFilter('subcriteria', value, checked)} /><FilterChoices legend="Estado de asociación" options={filterOptions.associationStatuses} selected={draftFilters.associationStatuses} onToggle={(value, checked) => toggleFilter('associationStatuses', value, checked)} /></div>}{filterOptionsError && <p role="alert" className="text-xs text-rose-700">No se pudieron cargar las opciones de filtrado.</p>}</form>

      {!canWrite && <ReadOnlyNotice />}

      {selectionCount > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4"><span className="text-sm font-medium text-brand-900">{selectedIds.size} documento(s) y {selectedFolderIds.size} carpeta(s) seleccionada(s)</span><div className="flex flex-wrap gap-2">{repositoryMode === 'folders' && selectedFolderIds.size === 0 && <>{currentFolderId != null && <button type="button" onClick={() => handleMoveDocuments(parentTarget)} className="rounded-md border border-brand-200 bg-white px-3 py-2 text-xs text-brand-800">Mover al nivel superior</button>}{folders.map((folder) => <button key={folder.id} type="button" onClick={() => handleMoveDocuments(folder.id)} className="rounded-md border border-brand-200 bg-white px-3 py-2 text-xs text-brand-800">Mover a {folder.name}</button>)}</>}<button type="button" onClick={clearSelection} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-xs text-steel-600">Deseleccionar</button><button type="button" onClick={handleTrashSelected} disabled={trashRepositoryItems.isPending} className="rounded-md bg-rose-600 px-3 py-2 text-xs text-white disabled:opacity-50">Mover a papelera</button></div></div>}

      <section className="min-w-0 overflow-hidden rounded-xl2 bg-white shadow-soft ring-1 ring-steel-200/60" aria-live="polite">
        {isError ? <div className="p-12 text-center text-sm text-rose-700">No se pudo cargar el repositorio. <button type="button" onClick={() => (repositoryMode === 'all' ? allQuery.refetch() : folderQuery.refetch())} className="underline">Reintentar</button></div> : isLoading ? <div className="p-12 text-center text-sm text-steel-500">Cargando repositorio…</div> : !folders.length && !documents.length ? <div className="p-16 text-center"><h2 className="font-display text-lg font-semibold text-ink-900">{filtersAreApplied ? 'No se encontraron coincidencias' : repositoryMode === 'folders' ? 'Esta ubicación está vacía' : 'Aún no hay evidencias'}</h2><p className="mt-1 text-sm text-steel-500">{filtersAreApplied ? 'Los criterios ingresados se mantienen visibles para que puedas modificarlos.' : 'Carga documentos para comenzar.'}</p></div> : viewMode === 'grid' ? (
          <div className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {folders.map((folder) => <article key={`folder-${folder.id}`} onDoubleClick={() => setCurrentFolderId(folder.id)} onContextMenu={(event) => openMenu(event, 'folder', folder)} className={`relative h-full rounded-xl border bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift ${selectedFolderIds.has(folder.id) ? 'border-brand-400 ring-1 ring-brand-400' : 'border-steel-200'} ${folder.match === 'descendant' ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3 pr-8"><SelectionCheckbox aria-label={`Seleccionar carpeta ${folder.name}`} checked={selectedFolderIds.has(folder.id)} onChange={() => toggleFolderSelect(folder.id)} disabled={!canWrite || !folder.canManage} /><button type="button" onClick={() => setCurrentFolderId(folder.id)} aria-label={`Abrir ${folder.name}`} className="grid h-12 w-14 shrink-0 place-items-center rounded-lg hover:bg-steel-50"><FolderIcon color={folder.color} className="h-9 w-9" /></button><div className="min-w-0 flex-1">{renderRename('folder', folder) || <button type="button" onClick={() => setCurrentFolderId(folder.id)} className="block max-w-full truncate font-semibold text-ink-900">{folder.name}</button>}<span className="text-xs text-steel-500">{folder.directDocumentCount} archivo(s)</span></div></div>
              <button type="button" onClick={(event) => openMenu(event, 'folder', folder)} aria-label={`Acciones para ${folder.name}`} className="absolute right-3 top-3 rounded-md px-2 py-1 text-steel-500 hover:bg-steel-100">⋮</button><div className="mt-3 border-t border-steel-100 pt-3"><p className="mb-2 text-[10px] font-semibold uppercase text-steel-400">Vista previa</p>{folder.preview.length ? folder.preview.map((document) => <div key={document.id} className="flex items-center gap-2 py-1 text-xs text-steel-700"><ExtensionIcon format={document.format} /><span className="truncate">{document.name}</span></div>) : <p className="text-xs text-steel-400">Sin archivos directos</p>}</div>
            </article>)}
            {documents.map((document) => <article key={`doc-${document.id}`} onContextMenu={(event) => repositoryMode === 'folders' && document.folderId === currentFolderId && openMenu(event, 'document', document)} className={`group overflow-hidden rounded-xl bg-white shadow-soft ring-1 ${selectedIds.has(document.id) ? 'ring-brand-400' : 'ring-steel-200'} ${highlightedIds.has(document.id) ? 'animate-pulse-highlight' : ''}`}><div className="relative border-b border-steel-100"><Link to={`/documents/${document.id}`}><DocumentThumbnail document={document} /></Link>{(repositoryMode === 'all' || document.folderId === currentFolderId) && <label className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-white/95 shadow-sm"><input type="checkbox" checked={selectedIds.has(document.id)} onChange={() => toggleSelect(document.id)} disabled={!canEditDocument(document) || document.vectorizationStatus === 'PROCESSING'} className="repository-checkbox" /><span className="sr-only">Seleccionar {document.name}</span></label>}{repositoryMode === 'folders' && document.folderId === currentFolderId && <button type="button" onClick={(event) => openMenu(event, 'document', document)} className="absolute right-3 top-3 rounded-md bg-white/95 px-2 py-1 text-steel-600 shadow-sm">⋮</button>}</div><div className="p-4">{renderRename('document', document) || <Link to={`/documents/${document.id}`} className="line-clamp-2 font-medium text-brand-700 hover:underline">{document.name}</Link>}<div className="mt-2 flex items-center gap-2"><ExtensionIcon format={document.format} /><span className="text-xs text-steel-500">{fmtSize(document.sizeBytes)}</span></div>{document.folderPath && <p className="mt-2 truncate text-[11px] text-steel-400">De {document.folderPath}</p>}<div className="mt-3 flex items-center justify-between border-t border-steel-100 pt-3"><span className="text-xs text-steel-500">{sourceLabel(document.source)}</span><TrashIconButton document={document} onClick={() => handleTrash(document)} disabled={!canEditDocument(document) || document.vectorizationStatus === 'PROCESSING'} /></div></div></article>)}
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-steel-50 text-left text-xs uppercase tracking-wide text-steel-500"><tr><th className="w-12 px-4 py-3"><SelectionCheckbox aria-label="Seleccionar todos" checked={allSelected} indeterminate={!allSelected && selectionCount > 0} disabled={!selectableCount} onChange={toggleSelectAll} /></th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Ubicación / origen</th><th className="px-4 py-3">Clasificación</th><th className="px-4 py-3">Análisis</th><th className="w-20 px-4 py-3 text-center">Acciones</th></tr></thead><tbody className="divide-y divide-steel-100">
            {folders.map((folder) => <tr key={`folder-${folder.id}`} onDoubleClick={() => setCurrentFolderId(folder.id)} onContextMenu={(event) => openMenu(event, 'folder', folder)} className={`${selectedFolderIds.has(folder.id) ? 'bg-brand-50' : 'hover:bg-steel-50/60'} ${folder.match === 'descendant' ? 'opacity-60' : ''}`}><td className="px-4 py-3 align-top"><SelectionCheckbox aria-label={`Seleccionar carpeta ${folder.name}`} checked={selectedFolderIds.has(folder.id)} onChange={() => toggleFolderSelect(folder.id)} disabled={!canWrite || !folder.canManage} /></td><td className="px-4 py-3"><div className="flex items-center gap-3"><button type="button" onClick={() => setCurrentFolderId(folder.id)} aria-label={`Abrir ${folder.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-steel-50"><FolderIcon color={folder.color} className="h-7 w-7" /></button>{renderRename('folder', folder) || <button type="button" onClick={() => setCurrentFolderId(folder.id)} className="font-medium text-ink-900">{folder.name}</button>}</div><div className="ml-12 mt-1 text-xs text-steel-400">{folder.directDocumentCount} archivo(s)</div></td><td className="px-4 py-3 text-steel-500">Carpeta compartida</td><td className="px-4 py-3 text-steel-400">—</td><td className="px-4 py-3 text-steel-400">—</td><td className="px-4 py-3 text-center"><button type="button" onClick={(event) => openMenu(event, 'folder', folder)} aria-label={`Acciones para ${folder.name}`} className="rounded-md px-3 py-1 text-lg text-steel-500 hover:bg-steel-100">⋮</button></td></tr>)}
            {documents.map((document) => <tr key={`doc-${document.id}`} onContextMenu={(event) => repositoryMode === 'folders' && document.folderId === currentFolderId && openMenu(event, 'document', document)} className={selectedIds.has(document.id) ? 'bg-brand-50' : 'hover:bg-steel-50/60'}><td className="px-4 py-4 align-top">{(repositoryMode === 'all' || document.folderId === currentFolderId) && <SelectionCheckbox aria-label={`Seleccionar ${document.name}`} checked={selectedIds.has(document.id)} onChange={() => toggleSelect(document.id)} disabled={!canEditDocument(document) || document.vectorizationStatus === 'PROCESSING'} />}</td><td className="px-4 py-4 align-top">{renderRename('document', document) || <Link to={`/documents/${document.id}`} className="font-medium text-brand-700 hover:underline">{document.name}</Link>}<div className="mt-2 flex items-center gap-2"><ExtensionIcon format={document.format} /><span className="text-xs text-steel-500">{fmtSize(document.sizeBytes)}</span></div>{document.folderPath && <p className="mt-1 text-[11px] text-steel-400">De {document.folderPath}</p>}</td><td className="px-4 py-4 align-top text-xs text-steel-600">{sourceLabel(document.source)}</td><td className="px-4 py-4 align-top"><span className={`rounded-md px-2 py-1 text-xs ring-1 ${STATUS_STYLE[document.associationStatus] || ''}`}>{document.associationStatus}</span>{document.subcriterion && <p className="mt-2 text-xs text-steel-500">{document.subcriterion}</p>}</td><td className="px-4 py-4 align-top"><span className="rounded-md bg-brand-50 px-2 py-1 text-xs text-brand-800">{ANALYSIS_LABELS[normalizeAnalysisStatus(document.analysisStatus)]}</span></td><td className="px-4 py-4 text-center">{repositoryMode === 'folders' && document.folderId === currentFolderId ? <button type="button" onClick={(event) => openMenu(event, 'document', document)} aria-label={`Acciones para ${document.name}`} className="rounded-md px-3 py-1 text-lg text-steel-500 hover:bg-steel-100">⋮</button> : repositoryMode === 'all' ? <TrashIconButton document={document} onClick={() => handleTrash(document)} disabled={!canEditDocument(document) || document.vectorizationStatus === 'PROCESSING'} /> : null}</td></tr>)}
          </tbody></table></div>
        )}
      </section>

      {itemMenu}
      <CreateFolderModal open={createOpen} count={selectedIds.size} parentName={explorer.currentFolder?.name} onClose={() => setCreateOpen(false)} onCreate={handleCreateFolder} pending={createFolder.isPending} />
      <DeleteFolderModal folder={deleteFolderTarget} onClose={() => setDeleteFolderTarget(null)} onDelete={handleDeleteFolder} pending={deleteFolder.isPending} />
      <MessageModal message={message} onClose={() => setMessage(null)} />
    </div>
  );
}
