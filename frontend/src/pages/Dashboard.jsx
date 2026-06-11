import { Link } from 'react-router-dom';
import { useCompliance } from '../hooks/useApi.js';
import TrafficLight from '../components/TrafficLight.jsx';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-CL') : '—');

const STATUS_COLOR = {
  green: 'text-emerald-600',
  yellow: 'text-amber-600',
  red: 'text-rose-600',
};

/** Devuelve cuántos años tiene un documento (con decimales). */
function yearsAgo(dateStr) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Barra de antigüedad: verde < 1 año, amarilla 1-2 años, naranja 2-3 años, roja > 3 años.
 * El ancho representa qué tan cerca está del límite de 3 años (máximo).
 */
function AgeBar({ documentDate, name, current }) {
  const years = yearsAgo(documentDate);
  if (years === null) return null;

  const pct = Math.min((years / 3) * 100, 100);
  const barColor =
    years < 1 ? 'bg-emerald-400' :
    years < 2 ? 'bg-amber-400' :
    years < 3 ? 'bg-orange-400' :
               'bg-rose-500';

  const label =
    years < 1
      ? `${Math.round(years * 12)} meses`
      : `${years.toFixed(1)} años`;

  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-stone-600 max-w-[55%]" title={name}>{name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`tnum font-medium ${current ? 'text-stone-500' : 'text-rose-500'}`}>
            {fmtDate(documentDate)}
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            current
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
          }`}>
            {current ? label : 'Vencido'}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
          title={`${years.toFixed(1)} años de antigüedad (límite: 3 años)`}
        />
      </div>
    </li>
  );
}

function HealthRing({ pct }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const stroke = pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#e11d48';
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#e7e2d6" strokeWidth="10" />
      <circle
        className="ring-progress"
        cx="60" cy="60" r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ '--ring-circ': circ, transition: 'stroke-dashoffset 1s var(--ease-out)' }}
      />
      <text
        x="60" y="58"
        transform="rotate(90 60 60)"
        textAnchor="middle"
        className="tnum fill-ink-900 font-display"
        style={{ fontSize: '26px', fontWeight: 600 }}
      >
        {pct}%
      </text>
      <text
        x="60" y="76"
        transform="rotate(90 60 60)"
        textAnchor="middle"
        className="fill-stone-400"
        style={{ fontSize: '10px', letterSpacing: '0.1em' }}
      >
        SUFICIENTE
      </text>
    </svg>
  );
}

function Stat({ color, count, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <TrafficLight color={color} />
      <span className="tnum text-xl font-semibold text-ink-900">{count}</span>
      <span className="text-sm text-stone-500">{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useCompliance();

  if (isLoading)
    return (
      <div className="space-y-6">
        <div>
          <div className="skeleton h-9 w-80 mb-2" />
          <div className="skeleton h-4 w-52" />
        </div>
        <div className="skeleton h-36 w-full rounded-xl2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl2 bg-white shadow-soft p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="skeleton h-3 w-12" />
                  <div className="skeleton h-5 w-3/4" />
                </div>
                <div className="skeleton h-5 w-5 rounded-full ml-4" />
              </div>
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );

  if (error)
    return (
      <p className="alert-in rounded-lg bg-rose-50 text-rose-700 text-sm px-4 py-3 ring-1 ring-rose-100">
        Error al cargar el cumplimiento.
      </p>
    );

  const items = data.items || [];
  const counts = items.reduce((a, it) => ((a[it.color] = (a[it.color] || 0) + 1), a), {});
  const green = counts.green || 0;
  const yellow = counts.yellow || 0;
  const red = counts.red || 0;
  const total = items.length;
  const pct = total ? Math.round((green / total) * 100) : 0;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
          {data.criterion?.code}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink-900">
          Tablero de salud institucional
        </h1>
        <p className="text-stone-500 mt-1">{data.criterion?.name}</p>
      </header>

      {!data.canCalculate ? (
        <div className="alert-in rounded-xl2 bg-amber-50 border border-amber-200 text-amber-800 p-6">
          {data.message}{' '}
          <Link to="/documents" className="font-medium underline decoration-amber-400 underline-offset-2">
            Ir al repositorio
          </Link>
        </div>
      ) : (
        <>
          {/* Hero de salud */}
          <section className="relative overflow-hidden rounded-xl2 bg-white shadow-soft ring-1 ring-stone-200/60">
            <span className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/[0.06] blur-2xl" />
            <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:gap-10">
              <div className="shrink-0">
                <HealthRing pct={pct} />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl font-semibold text-ink-900">
                  {green} de {total} subcriterios con evidencia suficiente
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Estado consolidado del Criterio 9 según los documentos validados hasta hoy.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
                  <Stat color="green" count={green} label="suficientes" />
                  <Stat color="yellow" count={yellow} label="parciales" />
                  <Stat color="red" count={red} label="insuficientes" />
                </div>
              </div>
            </div>
            <div className="flex h-1.5 w-full overflow-hidden">
              {green > 0 && <span style={{ flex: green }} className="bg-emerald-500" />}
              {yellow > 0 && <span style={{ flex: yellow }} className="bg-amber-400" />}
              {red > 0 && <span style={{ flex: red }} className="bg-rose-500" />}
            </div>
          </section>

          <div className="card-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.subcriterionId}
                className="group rounded-xl2 bg-white shadow-soft ring-1 ring-stone-200/50 p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                      {item.code}
                    </p>
                    <h3 className="mt-0.5 font-display text-base font-semibold leading-snug text-ink-900">
                      {item.name}
                    </h3>
                  </div>
                  <TrafficLight color={item.color} size="lg" />
                </div>

                <p className="mt-3 text-sm font-medium text-stone-600">
                  Estado:{' '}
                  <span className={STATUS_COLOR[item.color] || 'text-rose-600'}>{item.status}</span>
                </p>
                <p className="text-xs text-stone-400 mb-3">
                  <span className="tnum">{item.validatedCount}</span> documento(s) validado(s)
                </p>

                {/* Antigüedad de documentos con barra visual */}
                {item.documents.length > 0 && (
                  <div className="border-t border-stone-100 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-2">
                      Antigüedad de documentos
                    </p>
                    <ul className="space-y-2.5">
                      {item.documents.map((d) => (
                        <AgeBar
                          key={d.id}
                          documentDate={d.documentDate}
                          name={d.name}
                          current={d.current}
                        />
                      ))}
                    </ul>
                    {/* Leyenda de colores */}
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-stone-400">
                      <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-full bg-emerald-400"/>&lt;1 año</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-full bg-amber-400"/>1-2 años</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-full bg-orange-400"/>2-3 años</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-full bg-rose-500"/>&gt;3 años</span>
                    </div>
                  </div>
                )}

                {item.acceptedEvidenceTypes && item.acceptedEvidenceTypes.length > 0 && (
                  <div className="mt-3 border-t border-stone-100 pt-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      Evidencia típicamente aceptada
                    </p>
                    <ul className="mt-1 list-disc list-inside text-xs text-stone-500">
                      {item.acceptedEvidenceTypes.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
