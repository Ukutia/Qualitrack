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
        <h1 className="text-2xl font-bold text-slate-800">Cargar evidencia</h1>
        <p className="text-slate-500 mt-1">
          Formatos aceptados: PDF, DOCX, XLSX · Tamaño máximo: {MAX_MB}MB.
        </p>
      </header>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-brand-500"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {file ? (
          <p className="text-slate-700 font-medium">{file.name}</p>
        ) : (
          <p className="text-slate-500">
            Arrastre un archivo aquí o <span className="text-brand-600 font-medium">haga clic</span> para
            seleccionar.
          </p>
        )}
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
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
              className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-medium"
            >
              Reemplazar
            </button>
            <button
              onClick={() => send('keep')}
              className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium"
            >
              Conservar ambos
            </button>
            <button
              onClick={() => setDuplicate(null)}
              className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => send()}
          disabled={!file || upload.isPending}
          className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 font-medium disabled:opacity-50"
        >
          {upload.isPending ? 'Cargando…' : 'Cargar documento'}
        </button>
      )}
    </div>
  );
}
