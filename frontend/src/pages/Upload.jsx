import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUploadDocument } from '../hooks/useApi.js';

const ACCEPT = '.pdf,.docx,.xlsx';
const MAX_MB = 10;

export default function Upload() {
  const upload = useUploadDocument();
  const navigate = useNavigate();
  const inputRef = useRef();
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState(null); // {type, text}
  const [duplicate, setDuplicate] = useState(null); // info del doc existente
  const [dragOver, setDragOver] = useState(false);

  function pick(f) {
    setMessage(null);
    setDuplicate(null);
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPT.includes(ext)) {
      setMessage({ type: 'error', text: `Formato no permitido (${ext}). Solo PDF, DOCX o XLSX.` });
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setMessage({ type: 'error', text: `El archivo supera los ${MAX_MB}MB.` });
      return;
    }
    setFile(f);
  }

  async function send(onDuplicate) {
    if (!file) return;
    setMessage(null);
    try {
      const res = await upload.mutateAsync({ file, onDuplicate });
      setMessage({ type: 'success', text: res.message });
      setFile(null);
      setDuplicate(null);
      if (inputRef.current) inputRef.current.value = '';
      setTimeout(() => navigate('/documents'), 900);
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'DUPLICATE_NAME') {
        setDuplicate(data.existing);
        return;
      }
      setMessage({ type: 'error', text: data?.error || 'Error al cargar el archivo.' });
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">Cargar evidencia</h1>
        <p className="text-stone-500 mt-1">
          Formatos aceptados: PDF, DOCX, XLSX · Tamaño máximo: <span className="tnum">{MAX_MB}</span>MB.
        </p>
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group flex flex-col items-center justify-center gap-3 rounded-xl2 border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'bg-brand-50 border-brand-500 scale-[1.01]'
            : 'bg-white border-stone-300 hover:border-brand-400 hover:bg-brand-50/40'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <span
          className={`grid h-14 w-14 place-items-center rounded-2xl ring-1 transition-colors ${
            file ? 'bg-emerald-50 ring-emerald-200' : 'bg-brand-50 ring-brand-100'
          }`}
        >
          <svg viewBox="0 0 24 24" className={`h-7 w-7 ${file ? 'text-emerald-600' : 'text-brand-500'}`} fill="none" stroke="currentColor" strokeWidth="1.6">
            {file ? (
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <>
                <path d="M12 16V4m0 0L8 8m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
          </svg>
        </span>
        {file ? (
          <p className="font-medium text-ink-900">{file.name}</p>
        ) : (
          <p className="text-stone-500">
            Arrastra un archivo aquí o{' '}
            <span className="font-medium text-brand-600">haz clic</span> para seleccionar.
          </p>
        )}
      </div>

      {message && (
        <div
          className={`alert-in rounded-lg px-4 py-3 text-sm ${
            message.type === 'error'
              ? 'bg-rose-50 text-rose-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {duplicate ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 space-y-3">
          <p className="text-sm text-amber-800">
            Ya existe <strong>{duplicate.name}</strong> (creado el{' '}
            {new Date(duplicate.creationDate).toLocaleDateString('es-CL')}, subido el{' '}
            {new Date(duplicate.uploadDate).toLocaleString('es-CL')}). ¿Qué desea hacer?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => send('replace')}
              className="btn rounded-lg bg-rose-600 hover:bg-rose-700 transition-colors duration-150 text-white px-4 py-2 text-sm font-medium"
            >
              Reemplazar
            </button>
            <button
              onClick={() => send('keep')}
              className="btn rounded-lg bg-brand-600 hover:bg-brand-700 transition-colors duration-150 text-white px-4 py-2 text-sm font-medium"
            >
              Conservar ambos
            </button>
            <button
              onClick={() => setDuplicate(null)}
              className="btn rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors duration-150 text-slate-700 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => send()}
          disabled={!file || upload.isPending}
          className="btn rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-medium shadow-soft hover:shadow-lift disabled:opacity-50 disabled:shadow-none"
        >
          {upload.isPending ? 'Cargando…' : 'Cargar documento'}
        </button>
      )}
    </div>
  );
}
