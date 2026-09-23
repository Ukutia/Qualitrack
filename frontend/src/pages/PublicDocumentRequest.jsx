import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  usePublicDocumentRequest,
  useUploadPublicDocumentRequest,
} from '../hooks/useApi.js';

function errorMessage(error) {
  return error?.response?.data?.error || 'No fue posible cargar el documento. Inténtalo nuevamente.';
}

export default function PublicDocumentRequest() {
  const { token } = useParams();
  const request = usePublicDocumentRequest(token);
  const upload = useUploadPublicDocumentRequest(token);
  const [file, setFile] = useState(null);
  const [clientError, setClientError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setClientError('');
    if (!file) {
      setClientError('Selecciona un archivo para continuar.');
      return;
    }
    const maxBytes = (request.data?.maxFileSizeMb || 10) * 1024 * 1024;
    if (file.size > maxBytes) {
      setClientError(`El archivo supera el máximo de ${request.data?.maxFileSizeMb || 10} MB.`);
      return;
    }
    await upload.mutateAsync(file).catch(() => {});
  }

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
            <InvalidLink />
          ) : upload.isSuccess ? (
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl text-emerald-700 ring-1 ring-emerald-200">✓</div>
              <h1 className="mt-4 font-display text-2xl font-semibold">Documento recibido</h1>
              <p className="mt-2 text-sm leading-6 text-steel-600">
                <span className="font-medium text-ink-900">{upload.data.name}</span> fue vinculado correctamente a la solicitud.
              </p>
              <p className="mt-4 text-xs text-steel-500">Este enlace quedó invalidado y no puede volver a utilizarse.</p>
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

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="requested-document" className="block text-sm font-medium text-ink-900">Seleccionar documento</label>
                  <input
                    id="requested-document"
                    type="file"
                    required
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] || null);
                      setClientError('');
                      upload.reset();
                    }}
                    className="mt-2 block w-full rounded-lg border border-steel-300 bg-white px-3 py-2.5 text-sm text-steel-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
                  />
                  <p className="mt-2 text-xs text-steel-500">
                    PDF, DOC, DOCX, XLS o XLSX. Máximo {request.data.maxFileSizeMb} MB.
                  </p>
                </div>

                {(clientError || upload.isError) && (
                  <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                    {clientError || errorMessage(upload.error)}
                  </div>
                )}

                <button type="submit" disabled={!file || upload.isPending} className="btn w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                  {upload.isPending ? 'Cargando documento…' : 'Enviar documento'}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InvalidLink() {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-xl text-red-700 ring-1 ring-red-200">!</div>
      <h1 className="mt-4 font-display text-2xl font-semibold">Enlace no vigente</h1>
      <p className="mt-2 text-sm leading-6 text-steel-600">
        Este enlace fue reemplazado, pausado, cancelado o ya fue utilizado. Solicita al remitente el enlace más reciente.
      </p>
    </div>
  );
}
