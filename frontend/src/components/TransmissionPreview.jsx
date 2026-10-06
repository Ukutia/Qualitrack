import { useState } from 'react';
import { api } from '../lib/api.js';

const PREVIEW_CHARS = 1500;

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Muestra lo que se envía al entorno de análisis junto al contenido original
 * (CDA2). El envío real dura milisegundos y no se puede ver; esto lo genera
 * con la misma función del backend, sin lanzar el análisis.
 */
export default function TransmissionPreview({ docId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData((await api.get(`/documents/${docId}/transmission-preview`)).data);
    } catch (err) {
      setError(err?.response?.data?.error || 'No fue posible generar el contenido a transmitir.');
    } finally {
      setLoading(false);
    }
  };

  const ext = data?.format === 'text' ? 'txt' : data?.format;

  return (
    <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-steel-800">Contenido enviado al análisis</h2>
          <p className="mt-1 text-sm text-steel-500">
            Lo que sale del servidor hacia el entorno de análisis, comparado con el original. No inicia ningún análisis.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="shrink-0 rounded-lg border border-steel-300 px-4 py-2 text-sm font-medium text-steel-700 hover:bg-steel-50 disabled:opacity-60"
        >
          {loading ? 'Generando…' : data ? 'Generar de nuevo' : 'Ver contenido a transmitir'}
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {data && (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-steel-50 p-3">
              <dt className="text-steel-500">Cifrado</dt>
              <dd className="font-medium text-steel-800">{data.algorithm} · IV {data.iv.slice(0, 12)}…</dd>
            </div>
            <div className="rounded-lg bg-steel-50 p-3">
              <dt className="text-steel-500">¿El texto original aparece en lo transmitido?</dt>
              <dd className={`font-medium ${data.sampleFound ? 'text-rose-700' : 'text-emerald-700'}`}>
                {data.sampleFound ? 'Sí' : 'No'}
              </dd>
            </div>
            <div className="rounded-lg bg-steel-50 p-3">
              <dt className="text-steel-500">Bytes iguales en la misma posición</dt>
              <dd className="font-medium text-steel-800">
                {data.matchingBytesPct.toLocaleString('es-CL', { maximumFractionDigits: 2 })} % de {data.bytes.toLocaleString('es-CL')}
                <span className="font-normal text-steel-500"> (≈0,4 % es puro azar)</span>
              </dd>
            </div>
            <div className="rounded-lg bg-steel-50 p-3">
              <dt className="text-steel-500">¿El analizador lo recupera intacto con la clave?</dt>
              <dd className={`font-medium ${data.roundTripOk ? 'text-emerald-700' : 'text-rose-700'}`}>
                {data.roundTripOk ? 'Sí' : 'No'}
              </dd>
            </div>
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-steel-700">Original</h3>
                <button
                  type="button"
                  onClick={() => download(`documento-${docId}-original.${ext}`, data.original, 'text/plain;charset=utf-8')}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Descargar
                </button>
              </div>
              <pre className="h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-steel-200 p-3 text-xs text-steel-600">
                {data.original.slice(0, PREVIEW_CHARS)}
              </pre>
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-steel-700">Transmitido</h3>
                <button
                  type="button"
                  onClick={() => download(`documento-${docId}-transmitido.bin`, base64ToBytes(data.transmitted), 'application/octet-stream')}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Descargar
                </button>
              </div>
              <pre className="h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-steel-200 p-3 font-mono text-xs text-steel-600">
                {data.transmitted.slice(0, PREVIEW_CHARS)}
              </pre>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
