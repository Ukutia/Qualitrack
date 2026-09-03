import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUploadDocument } from '../hooks/useApi.js';

const ACCEPT = '.pdf,.docx,.xlsx';
const MAX_MB = 10;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export default function Upload() {
  const upload = useUploadDocument();
  const navigate = useNavigate();
  const inputRef = useRef();
  const itemsRef = useRef([]);
  const [items, setItems] = useState([]); // {id, file, status, message, duplicateInfo}
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function setItemsBoth(updater) {
    setItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      itemsRef.current = next;
      return next;
    });
  }

  function updateItem(id, patch) {
    setItemsBoth((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const newItems = files.map((f) => {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      if (!ACCEPT.includes(ext)) {
        return { id: uid(), file: f, status: 'error', message: `Formato no permitido (${ext}). Solo PDF, DOCX o XLSX.` };
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        return { id: uid(), file: f, status: 'error', message: `El archivo supera los ${MAX_MB}MB.` };
      }
      return { id: uid(), file: f, status: 'pending' };
    });
    setItemsBoth((prev) => [...prev, ...newItems]);
  }

  async function processNext() {
    const current = itemsRef.current;
    const idx = current.findIndex((it) => it.status === 'pending');
    if (idx === -1) {
      setProcessing(false);
      if (canSeeRepository && current.some((it) => it.status === 'success')) {
        setTimeout(() => navigate('/documents'), 900);
      }
      return;
    }
    const item = current[idx];
    updateItem(item.id, { status: 'uploading' });
    try {
<<<<<<< Updated upstream
      const res = await upload.mutateAsync({ file, onDuplicate });
      setMessage({ type: 'success', text: res.message });
      setFile(null);
      setDuplicate(null);
      if (inputRef.current) inputRef.current.value = '';
      setTimeout(() => navigate('/documents'), 900);
=======
      const res = await upload.mutateAsync({ file: item.file });
      updateItem(item.id, { status: 'success', message: res.message });
      await processNext();
>>>>>>> Stashed changes
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'DUPLICATE_NAME') {
        updateItem(item.id, { status: 'duplicate', duplicateInfo: data.existing });
        setProcessing(false);
        return;
      }
      updateItem(item.id, { status: 'error', message: data?.error || 'Error al cargar el archivo.' });
      await processNext();
    }
  }

  function startUpload() {
    if (processing || !itemsRef.current.some((it) => it.status === 'pending')) return;
    setProcessing(true);
    processNext();
  }

  async function resolveDuplicate(item, action) {
    setProcessing(true);
    if (action === 'skip') {
      updateItem(item.id, { status: 'error', message: 'Omitido por el usuario.' });
      await processNext();
      return;
    }
    updateItem(item.id, { status: 'uploading' });
    try {
      const res = await upload.mutateAsync({ file: item.file, onDuplicate: action });
      updateItem(item.id, { status: 'success', message: res.message });
    } catch (err) {
      const data = err.response?.data;
      updateItem(item.id, { status: 'error', message: data?.error || 'Error al cargar el archivo.' });
    }
    await processNext();
  }

  function removeItem(id) {
    setItemsBoth((prev) => prev.filter((it) => it.id !== id));
  }

  function clearAll() {
    if (processing) return;
    setItemsBoth([]);
    if (inputRef.current) inputRef.current.value = '';
  }

  const pendingCount = items.filter((it) => it.status === 'pending').length;
  const hasDuplicate = items.some((it) => it.status === 'duplicate');
  const allDone = items.length > 0 && items.every((it) => it.status === 'success' || it.status === 'error');

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Cargar evidencia</h1>
        <p className="text-steel-500 mt-1">
          Formatos aceptados: PDF, DOCX, XLSX · Tamaño máximo: <span className="tnum">{MAX_MB}</span>MB. Puedes seleccionar varios archivos a la vez.
        </p>
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group flex flex-col items-center justify-center gap-3 rounded-xl2 border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'bg-brand-50 border-brand-500 scale-[1.01]'
            : 'bg-white border-steel-300 hover:border-brand-400 hover:bg-brand-50/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <span className="grid h-14 w-14 place-items-center rounded-2xl ring-1 bg-brand-50 ring-brand-100">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-brand-500" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 16V4m0 0L8 8m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-steel-500">
          Arrastra uno o más archivos aquí o{' '}
          <span className="font-medium text-brand-600">haz clic</span> para seleccionar.
        </p>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-lg border border-steel-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  <StatusIcon status={it.status} />
                  <span className="truncate font-medium text-ink-900">{it.file.name}</span>
                </div>
                {it.status === 'pending' && (
                  <button
                    onClick={() => removeItem(it.id)}
                    className="text-steel-400 hover:text-rose-600 text-sm shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>
              {(it.status === 'error' || it.status === 'success') && it.message && (
                <p className={`mt-1 text-sm ${it.status === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {it.message}
                </p>
              )}

              {it.status === 'duplicate' && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-3">
                  {it.duplicateInfo.inTrash ? (
                    <p className="text-sm text-amber-800">
                      <strong>{it.duplicateInfo.name}</strong> ya existe, pero está en la{' '}
                      <span className="font-medium">papelera</span> (eliminado el{' '}
                      {new Date(it.duplicateInfo.deletedAt).toLocaleString('es-CL')}). ¿Qué desea hacer?
                    </p>
                  ) : (
                    <p className="text-sm text-amber-800">
                      Ya existe <strong>{it.duplicateInfo.name}</strong> (creado el{' '}
                      {new Date(it.duplicateInfo.creationDate).toLocaleDateString('es-CL')}, subido el{' '}
                      {new Date(it.duplicateInfo.uploadDate).toLocaleString('es-CL')}). ¿Qué desea hacer?
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {it.duplicateInfo.inTrash && (
                      <button
                        onClick={() => resolveDuplicate(it, 'restore')}
                        className="btn rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors duration-150 text-white px-4 py-2 text-sm font-medium"
                      >
                        Restaurar el existente
                      </button>
                    )}
                    <button
                      onClick={() => resolveDuplicate(it, 'replace')}
                      className="btn rounded-lg bg-rose-600 hover:bg-rose-700 transition-colors duration-150 text-white px-4 py-2 text-sm font-medium"
                    >
                      Reemplazar
                    </button>
                    <button
                      onClick={() => resolveDuplicate(it, 'keep')}
                      className="btn rounded-lg bg-brand-600 hover:bg-brand-700 transition-colors duration-150 text-white px-4 py-2 text-sm font-medium"
                    >
                      Conservar ambos
                    </button>
                    <button
                      onClick={() => resolveDuplicate(it, 'skip')}
                      className="btn rounded-lg bg-steel-100 hover:bg-steel-200 transition-colors duration-150 text-steel-700 px-4 py-2 text-sm"
                    >
                      Omitir este archivo
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={startUpload}
            disabled={pendingCount === 0 || processing || hasDuplicate}
            className="btn rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-medium shadow-soft hover:shadow-lift disabled:opacity-50 disabled:shadow-none"
          >
            {processing ? 'Cargando…' : `Cargar ${pendingCount || items.length} documento${(pendingCount || items.length) === 1 ? '' : 's'}`}
          </button>
          <button
            onClick={clearAll}
            disabled={processing}
            className="rounded-lg bg-steel-100 hover:bg-steel-200 transition-colors duration-150 text-steel-700 px-4 py-2.5 text-sm disabled:opacity-50"
          >
            Limpiar lista
          </button>
          {allDone && (
            <span className="text-sm text-steel-500">
              {items.filter((it) => it.status === 'success').length} de {items.length} cargados correctamente.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }) {
  const base = 'grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1';
  if (status === 'success') {
    return (
      <span className={`${base} bg-emerald-50 ring-emerald-200`}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className={`${base} bg-rose-50 ring-rose-200`}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === 'uploading') {
    return (
      <span className={`${base} bg-brand-50 ring-brand-100`}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand-500 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (status === 'duplicate') {
    return (
      <span className={`${base} bg-amber-50 ring-amber-200`}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 9v4m0 4h.01M10.3 3.9L2.7 17a1.6 1.6 0 0 0 1.4 2.4h15.8a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return <span className={`${base} bg-steel-100 ring-steel-200`} />;
}
