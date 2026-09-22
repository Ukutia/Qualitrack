import { useParams } from 'react-router-dom';
import { usePublicDocumentRequest } from '../hooks/useApi.js';

export default function PublicDocumentRequest() {
  const { token } = useParams();
  const request = usePublicDocumentRequest(token);

  return (
    <main className="min-h-screen bg-paper px-5 py-12 text-ink-900">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl font-semibold">Qualitrack</p>
          <p className="mt-1 text-sm text-steel-500">Recepción segura de evidencia</p>
        </div>

        <section className="rounded-xl2 bg-white p-7 shadow-soft ring-1 ring-steel-200/70">
          {request.isLoading ? (
            <p role="status" className="text-center text-sm text-steel-500">Validando enlace…</p>
          ) : request.isError ? (
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-xl text-red-700 ring-1 ring-red-200">!</div>
              <h1 className="mt-4 font-display text-2xl font-semibold">Enlace no vigente</h1>
              <p className="mt-2 text-sm leading-6 text-steel-600">
                Este enlace fue reemplazado, pausado, cancelado o ya no existe. Solicita al remitente el enlace más reciente.
              </p>
            </div>
          ) : (
            <div>
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">Enlace vigente</span>
              <h1 className="mt-4 font-display text-2xl font-semibold">Solicitud de documento</h1>
              <p className="mt-2 text-sm text-steel-500">Solicitud #{request.data.requestId}</p>
              <div className="mt-6 rounded-lg bg-steel-50 p-4 ring-1 ring-steel-200">
                <p className="text-xs font-medium uppercase tracking-wide text-steel-500">Documento solicitado</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-900">{request.data.description}</p>
              </div>
              <div className="mt-6 rounded-lg bg-brand-50 p-4 text-sm leading-6 text-brand-800 ring-1 ring-brand-200">
                El enlace funciona correctamente. La carga de archivos se habilitará en la siguiente etapa.
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
