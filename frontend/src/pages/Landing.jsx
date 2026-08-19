import { Link } from 'react-router-dom';
import { LEVEL_ORDER, levelMeta } from '../lib/levels.js';
import TrafficLight from '../components/TrafficLight.jsx';

const FEATURES = [
  {
    title: 'Semáforos en tiempo real',
    description:
      'Cada subcriterio del Criterio 9 se evalúa al instante: suficiente, parcial o insuficiente, sin esperar a la revisión manual.',
  },
  {
    title: 'Importación desde la nube',
    description:
      'Traiga evidencias directamente desde Google Drive o Dropbox, con detección de duplicados y resolución guiada.',
  },
  {
    title: 'Cifrado en reposo (AES-256)',
    description:
      'Cada documento cargado se cifra antes de almacenarse, protegiendo la evidencia institucional frente a accesos no autorizados.',
  },
  {
    title: 'Estructura versionada',
    description:
      'La estructura de criterios mantiene historial de versiones, con restauración segura ante cualquier cambio no deseado.',
  },
  {
    title: 'Papelera con recuperación',
    description:
      'Los documentos eliminados no se pierden: quedan disponibles para restaurar hasta que decida eliminarlos definitivamente.',
  },
  {
    title: 'Tablero de salud institucional',
    description:
      'Visualice de un vistazo el cumplimiento acumulado por nivel y detecte qué subcriterios requieren atención primero.',
  },
];

function Logo({ dark = false }) {
  return (
    <span
      className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${
        dark ? 'bg-ink-900 ring-black/5' : 'bg-white/5 ring-white/10'
      }`}
    >
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
        <circle cx="16" cy="16" r="10" fill="none" stroke="#d3a04e" strokeWidth="2" />
        <path
          d="M11 16.5l3.4 3.4L21 13"
          fill="none"
          stroke="#d3a04e"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function Landing() {
  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-steel-200/70 bg-paper/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo dark />
            <span className="font-display text-xl font-semibold tracking-tight text-ink-900">
              Qualitrack
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-8 text-sm font-medium text-steel-600">
            <a href="#niveles" className="hover:text-ink-900 transition-colors">Niveles</a>
            <a href="#funcionalidades" className="hover:text-ink-900 transition-colors">Funcionalidades</a>
          </nav>
          <Link
            to="/login"
            className="btn rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium shadow-soft hover:shadow-lift"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-900">
        <span className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <span className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-gold-500/10 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 sm:px-8 py-20 lg:py-28 grid lg:grid-cols-[1.1fr_1fr] gap-14 items-center">
          <div className="card-drop-in">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold-400/80">
              Acreditación CNA · Criterio 9
            </p>
            <h1 className="mt-4 font-display text-4xl sm:text-5xl font-semibold leading-tight text-steel-50">
              La evidencia, en orden. La acreditación, bajo control.
            </h1>
            <p className="mt-5 text-steel-400 leading-relaxed max-w-lg">
              Gestión y resultados del aseguramiento interno de la calidad, organizado tal como lo
              evalúa la CNA: tres niveles acumulativos y sus subcriterios, con semáforos en tiempo real
              y evidencia cifrada.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/login"
                className="btn rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 font-medium shadow-soft hover:shadow-lift"
              >
                Iniciar sesión
              </Link>
              <a
                href="#funcionalidades"
                className="text-sm font-medium text-steel-300 hover:text-steel-100 transition-colors"
              >
                Ver funcionalidades →
              </a>
            </div>
          </div>

          {/* Panel decorativo: mini tablero */}
          <div className="card-drop-in rounded-xl2 bg-white/[0.04] ring-1 ring-white/10 backdrop-blur p-6 shadow-lift">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-steel-500">
              Cumplimiento por nivel
            </p>
            <div className="mt-5 space-y-4">
              {LEVEL_ORDER.map((level, i) => {
                const meta = levelMeta(level);
                const color = i === 0 ? 'yellow' : i === 1 ? 'green' : 'red';
                return (
                  <div key={level} className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-4 py-3 ring-1 ring-white/5">
                    <TrafficLight color={color} size="lg" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-steel-100">
                        {meta.label} · {meta.title}
                      </p>
                      <p className="text-xs text-steel-500 truncate">{meta.short}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Niveles */}
      <section id="niveles" className="max-w-6xl mx-auto px-6 sm:px-8 py-20">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold-600">
            Tres niveles acumulativos
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-900">
            La misma lógica con la que evalúa la CNA
          </h2>
          <p className="mt-3 text-steel-600 leading-relaxed">
            Cada nivel exige el anterior. Qualitrack organiza la evidencia y calcula el cumplimiento
            siguiendo exactamente esa estructura acumulativa.
          </p>
        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-5 card-stagger">
          {LEVEL_ORDER.map((level) => {
            const meta = levelMeta(level);
            return (
              <div
                key={level}
                className="rounded-xl2 bg-white shadow-soft ring-1 ring-steel-200/50 p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.chip}`}>
                  {meta.label}
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">{meta.title}</h3>
                <p className="mt-2 text-sm text-steel-600 leading-relaxed">{meta.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="bg-white/60 border-y border-steel-200/60">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold-600">
              Funcionalidades
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-900">
              Todo lo que necesita el equipo de aseguramiento de la calidad
            </h2>
          </div>

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 card-stagger">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl2 bg-paper shadow-soft ring-1 ring-steel-200/50 p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
                  <span className="h-2 w-2 rounded-full bg-brand-600" />
                </span>
                <h3 className="mt-4 font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-2 text-sm text-steel-600 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-6xl mx-auto px-6 sm:px-8 py-20">
        <div className="rounded-xl2 bg-ink-900 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-900 px-8 py-14 text-center shadow-lift relative overflow-hidden">
          <span className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
          <h2 className="font-display text-3xl font-semibold text-steel-50">
            Gestione su evidencia de acreditación hoy
          </h2>
          <p className="mt-3 text-steel-400 max-w-xl mx-auto">
            Ingrese con su cuenta institucional para revisar el tablero, cargar evidencias y controlar
            el cumplimiento del Criterio 9.
          </p>
          <Link
            to="/login"
            className="btn mt-7 inline-block rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 font-medium shadow-soft hover:shadow-lift"
          >
            Iniciar sesión
          </Link>
        </div>
      </section>

      <footer className="border-t border-steel-200/60">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-steel-500">
          <span>© {new Date().getFullYear()} Qualitrack · Gestión de evidencias</span>
          <span>Acreditación CNA · Criterio 9</span>
        </div>
      </footer>
    </div>
  );
}
