import { Link } from 'react-router-dom';
import { useCompliance } from '../hooks/useApi.js';
import TrafficLight from '../components/TrafficLight.jsx';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-CL') : '—');

export default function Dashboard() {
  const { data, isLoading, error } = useCompliance();

  if (isLoading) return <p className="text-slate-500">Cargando tablero…</p>;
  if (error) return <p className="text-rose-600">Error al cargar el cumplimiento.</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Tablero de Salud Institucional</h1>
        <p className="text-slate-500 mt-1">
          {data.criterion?.code} · {data.criterion?.name}
        </p>
      </header>

      {!data.canCalculate ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 p-5">
          {data.message}{' '}
          <Link to="/documents" className="underline font-medium">
            Ir al repositorio
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item) => (
            <div key={item.subcriterionId} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400">{item.code}</p>
                  <h3 className="font-semibold text-slate-800 leading-tight">{item.name}</h3>
                </div>
                <TrafficLight color={item.color} size="lg" />
              </div>

              <p className="mt-3 text-sm font-medium">
                Estado:{' '}
                <span
                  className={
                    item.color === 'green'
                      ? 'text-emerald-600'
                      : item.color === 'yellow'
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }
                >
                  {item.status}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                {item.validatedCount} documento(s) validado(s)
              </p>

              {item.documents.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {item.documents.map((d) => (
                    <li key={d.id} className="flex justify-between gap-2">
                      <span className="truncate">{d.name}</span>
                      <span className={d.current ? 'text-slate-400' : 'text-rose-500'}>
                        {fmtDate(d.documentDate)}
                        {!d.current && ' (vencido)'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {item.acceptedEvidenceTypes && item.acceptedEvidenceTypes.length > 0 && (
                <div className="mt-3 border-t pt-2">
                  <p className="text-xs font-semibold text-slate-500">
                    Evidencia típicamente aceptada:
                  </p>
                  <ul className="list-disc list-inside text-xs text-slate-500">
                    {item.acceptedEvidenceTypes.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
