import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import fullLogo from '../assets/fulllogo.svg';

/* ────────────────────────────────────────────────────────────────────────
   Landing pública de Qualitrack.
   Mismo sistema visual que la app (petróleo + dorado + papel cálido,
   Fraunces para display y Outfit para texto) para que el salto de la
   landing al producto no se note.
   ──────────────────────────────────────────────────────────────────────── */

/** Revela su contenido cuando entra en viewport. `delay` escalona hermanos. */
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.classList.add('is-visible');

    if (typeof IntersectionObserver === 'undefined') {
      show();
      return;
    }
    // Red de seguridad: si el observer no llega a disparar (pestaña oculta al
    // cargar, prerender), el contenido no puede quedarse invisible.
    const fallback = setTimeout(show, 1600);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          io.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` }}>
      {children}
    </div>
  );
}

/* Iconografía de trazo, alineada con el logo (sin librerías externas). */
const icons = {
  archivo: 'M4 7h16M4 7v12a1 1 0 001 1h14a1 1 0 001-1V7M4 7l1.6-3h12.8L20 7M10 12h4',
  radar: 'M12 3v9l6.4 3.7M12 21a9 9 0 110-18 9 9 0 010 18z',
  semaforo: 'M9 3h6a1 1 0 011 1v16a1 1 0 01-1 1H9a1 1 0 01-1-1V4a1 1 0 011-1zM12 7.5v.01M12 12v.01M12 16.5v.01',
  capas: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  pluma: 'M4 20l4-1 11-11a2.1 2.1 0 10-3-3L5 16l-1 4zM14.5 6.5l3 3',
  nube: 'M7 18a4 4 0 01-.4-7.98A5.5 5.5 0 0117.6 9.2 3.9 3.9 0 0117 18H7zM12 15V9m0 0l-2.2 2.2M12 9l2.2 2.2',
  escudo: 'M12 3l7.5 3v5.6c0 4.3-3 8.2-7.5 9.4-4.5-1.2-7.5-5.1-7.5-9.4V6L12 3zM9.2 12.2l2 2 3.6-3.8',
};

function Icon({ path, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FEATURES = [
  {
    icon: icons.archivo,
    title: 'Repositorio con reglas',
    body: 'PDF, DOCX y XLSX hasta 10 MB. Validación de formato y tamaño, detección de duplicados y papelera con restauración.',
    tag: 'HU07',
  },
  {
    icon: icons.radar,
    title: 'Asociación asistida al Criterio 9',
    body: 'Cada evidencia recibe una propuesta de subcriterio con su justificación. Tú validas o descartas; todo queda en el historial de auditoría.',
    tag: 'HU01',
  },
  {
    icon: icons.semaforo,
    title: 'Semáforo de cumplimiento',
    body: 'Suficiente, Parcial o Insuficiente calculado por subcriterio según cantidad y antigüedad de la evidencia validada.',
    tag: 'HU02',
  },
  {
    icon: icons.capas,
    title: 'Estructura del informe versionada',
    body: 'Carga la estructura oficial de la CNA y compara versiones: qué sección se agregó, cuál se eliminó y cuál cambió de nombre.',
    tag: 'HU03',
  },
  {
    icon: icons.pluma,
    title: 'Redacción con autoguardado',
    body: 'Escribe el borrador dentro de la plataforma con títulos, negrita, cursiva y listas. Guarda solo en el servidor y se recupera íntegro.',
    tag: 'Redacción',
  },
  {
    icon: icons.nube,
    title: 'Importación desde Google Drive',
    body: 'Conecta la cuenta institucional por OAuth, navega tus carpetas e importa archivos sin descargarlos primero al escritorio.',
    tag: 'HU09',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Carga la estructura',
    body: 'Sube el índice oficial del informe CNA. Queda versionado desde el primer día.',
  },
  {
    n: '02',
    title: 'Reúne la evidencia',
    body: 'Arrastra archivos o impórtalos desde Google Drive. El sistema valida y descarta duplicados.',
  },
  {
    n: '03',
    title: 'Valida las asociaciones',
    body: 'Revisa la propuesta de subcriterio para cada documento y confirma o corrige en un clic.',
  },
  {
    n: '04',
    title: 'Redacta con datos a la vista',
    body: 'El semáforo te muestra dónde falta respaldo antes de escribir el capítulo.',
  },
];

const FAQ = [
  {
    q: '¿Qué alcance cubre hoy la plataforma?',
    a: 'El MVP se acota a una sede, hasta tres carreras y exclusivamente al Criterio 9 de la CNA — "Aseguramiento de la calidad de los programas formativos" — con el perfil de Encargado de Aseguramiento de Calidad.',
  },
  {
    q: '¿Cómo se calcula el estado de un subcriterio?',
    a: 'Suficiente cuando hay dos o más documentos validados con menos de tres años de antigüedad. Parcial cuando hay al menos uno validado pero supera los tres años, o cuando solo existe un documento vigente. Insuficiente cuando no hay evidencia validada.',
  },
  {
    q: '¿Necesito Google Drive para usarla?',
    a: 'No. La conexión a Drive es opcional: sin credenciales configuradas la plataforma funciona igual y la pantalla de nube muestra las instrucciones para habilitarla.',
  },
  {
    q: '¿Dónde quedan los archivos?',
    a: 'En el almacenamiento de la institución, cifrados en reposo con AES-256. La capa de almacenamiento está aislada, de modo que migrar a un bucket administrado no obliga a tocar el resto del sistema.',
  },
  {
    q: '¿La IA decide por mí?',
    a: 'No. El clasificador solo propone un subcriterio y explica por qué. Ninguna asociación se da por válida sin la confirmación explícita de una persona, y cada acción queda registrada.',
  },
];

/* Panel del hero: retrato del producto, no una captura pesada. */
function ProductPreview() {
  const rows = [
    { code: '9.1', label: 'Políticas y mecanismos de aseguramiento', state: 'ok', docs: 6 },
    { code: '9.2', label: 'Seguimiento de planes de mejora', state: 'ok', docs: 4 },
    { code: '9.3', label: 'Evaluación periódica del plan de estudios', state: 'warn', docs: 2 },
    { code: '9.4', label: 'Uso de resultados para la toma de decisiones', state: 'bad', docs: 0 },
  ];
  const tone = {
    ok: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Suficiente' },
    warn: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'Parcial' },
    bad: { dot: 'bg-rose-400', text: 'text-rose-300', label: 'Insuficiente' },
  };

  return (
    <div className="relative rounded-xl2 bg-ink-900 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-900 p-1.5 shadow-lift ring-1 ring-black/10">
      <span className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/25 blur-3xl" />
      <span className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-gold-500/10 blur-3xl" />

      <div className="relative rounded-[0.95rem] ring-1 ring-white/10">
        {/* Barra de ventana */}
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <p className="ml-2 text-[11px] uppercase tracking-[0.2em] text-stone-500">
            Tablero · Criterio 9
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-gold-400/80">
                Salud de la evidencia
              </p>
              <p className="mt-1 font-display text-4xl font-semibold text-stone-50 tnum">68%</p>
            </div>
            <div className="flex-1 max-w-[13rem]">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <span className="block h-full w-[68%] rounded-full bg-gradient-to-r from-brand-400 to-gold-400" />
              </div>
              <p className="mt-2 text-right text-xs text-stone-500 tnum">12 de 18 validadas</p>
            </div>
          </div>

          <div className="mt-5 space-y-1.5">
            {rows.map((r) => (
              <div
                key={r.code}
                className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/5"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${tone[r.state].dot}`} />
                <span className="w-8 shrink-0 text-xs font-semibold text-stone-400 tnum">
                  {r.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-stone-200">{r.label}</span>
                <span className="hidden shrink-0 text-xs text-stone-500 tnum sm:block">
                  {r.docs} docs
                </span>
                <span
                  className={`shrink-0 text-[11px] font-medium ${tone[r.state].text}`}
                >
                  {tone[r.state].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const ctaHref = user ? '/app' : '/login';
  const ctaLabel = user ? 'Ir al tablero' : 'Entrar a la plataforma';

  const nav = [
    { href: '#producto', label: 'Producto' },
    { href: '#como-funciona', label: 'Cómo funciona' },
    { href: '#seguridad', label: 'Seguridad' },
    { href: '#preguntas', label: 'Preguntas' },
  ];

  return (
    <div className="min-h-full">
      {/* ── Barra superior ─────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled ? 'border-b border-stone-900/[0.07] bg-paper/85 backdrop-blur-md' : ''
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="flex items-center">
            <img src={fullLogo} alt="Qualitrack" className="h-10 w-auto" />
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-sm font-medium text-stone-600 transition-colors hover:text-brand-700"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to={ctaHref}
              className="btn hidden rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-700 hover:shadow-lift sm:block"
            >
              {ctaLabel}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              className="btn grid h-9 w-9 place-items-center rounded-lg ring-1 ring-stone-300 md:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="alert-in border-t border-stone-900/[0.07] bg-paper/95 px-6 py-4 backdrop-blur md:hidden">
            <nav className="flex flex-col gap-1">
              {nav.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-900/5"
                >
                  {n.label}
                </a>
              ))}
              <Link
                to={ctaHref}
                className="btn mt-2 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white"
              >
                {ctaLabel}
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section id="top" className="relative overflow-hidden">
        <span className="pointer-events-none absolute inset-0 grid-paper" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
          {/* min-w-0: sin esto el min-content de la columna desborda en móvil. */}
          <div className="min-w-0">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-brand-700 ring-1 ring-brand-600/15">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                Acreditación CNA · Criterio 9
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-6 font-display text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-ink-900 sm:text-6xl">
                La evidencia, en orden.
                <br />
                <span className="hero-sheen">La acreditación, bajo control.</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
                Qualitrack reúne los documentos de tu institución, los asocia al subcriterio que
                corresponde y te muestra —en tiempo real— dónde el respaldo alcanza y dónde no.
                Llegas al informe con datos, no con carpetas compartidas.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  to={ctaHref}
                  className="btn rounded-lg bg-brand-600 px-6 py-3 text-[15px] font-medium text-white shadow-soft hover:bg-brand-700 hover:shadow-lift"
                >
                  {ctaLabel}
                </Link>
                <a
                  href="#producto"
                  className="btn rounded-lg bg-white/70 px-6 py-3 text-[15px] font-medium text-ink-800 ring-1 ring-stone-300 hover:bg-white"
                >
                  Ver qué incluye
                </a>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-stone-900/10 pt-7">
                {[
                  ['1 sede · 3 carreras', 'Alcance del MVP'],
                  ['≤ 5 s', 'Autoguardado del borrador'],
                  ['AES-256', 'Cifrado en reposo'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <dt className="font-display text-xl font-semibold text-ink-900 tnum">
                      {value}
                    </dt>
                    <dd className="mt-1 text-xs leading-snug text-stone-500">{label}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal delay={200} className="min-w-0">
            <ProductPreview />
          </Reveal>
        </div>
      </section>

      {/* ── El problema ────────────────────────────────────────────────── */}
      <section className="border-y border-stone-900/[0.07] bg-white/45">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold-600">
              Por qué existe
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">
              El problema nunca es la falta de evidencia. Es no saber dónde está.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              [
                'Carpetas dispersas',
                'La evidencia vive repartida entre correos, unidades compartidas y escritorios. Nadie tiene la foto completa hasta que ya es tarde.',
              ],
              [
                'Vigencia invisible',
                'Un documento de hace cinco años ocupa el mismo lugar que uno de este semestre. La antigüedad no se nota hasta la visita.',
              ],
              [
                'Informe a contrarreloj',
                'La redacción arranca sin saber qué subcriterios están cubiertos, y las brechas aparecen en la última semana.',
              ],
            ].map(([title, body], i) => (
              <Reveal key={title} delay={i * 90}>
                <div className="border-l-2 border-gold-400/60 pl-5">
                  <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Producto ───────────────────────────────────────────────────── */}
      <section id="producto" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <Reveal>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold-600">
            Producto
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">
            Todo el ciclo de la evidencia, en una sola plataforma.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-stone-600">
            Desde que el archivo entra hasta que el capítulo del informe queda escrito.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <article className="group h-full rounded-xl2 bg-white/70 p-6 shadow-soft ring-1 ring-stone-900/[0.06] transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600/[0.08] text-brand-700 ring-1 ring-brand-600/10 transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white">
                    <Icon path={f.icon} />
                  </span>
                  <span className="rounded-full bg-stone-900/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    {f.tag}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ──────────────────────────────────────────────── */}
      <section
        id="como-funciona"
        className="scroll-mt-20 border-y border-stone-900/[0.07] bg-white/45"
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold-600">
              Cómo funciona
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">
              Cuatro pasos entre el archivo suelto y el informe.
            </h2>
          </Reveal>

          <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
            <span className="pointer-events-none absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent md:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <li className="relative list-none">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-paper font-display text-sm font-semibold text-brand-700 tnum ring-1 ring-brand-600/20">
                    {s.n}
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold text-ink-900">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Seguridad ──────────────────────────────────────────────────── */}
      <section id="seguridad" className="scroll-mt-20 px-6 py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-xl2 bg-ink-900 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-900 px-8 py-16 text-stone-300 shadow-lift sm:px-14">
          <span className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
          <span className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />

          <div className="relative grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <div>
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/5 text-gold-400 ring-1 ring-white/10">
                  <Icon path={icons.escudo} className="h-6 w-6" />
                </span>
                <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.22em] text-gold-400/80">
                  Seguridad y trazabilidad
                </p>
                <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-stone-50 sm:text-4xl">
                  La evidencia de una acreditación no admite improvisación.
                </h2>
                <p className="mt-4 max-w-md leading-relaxed text-stone-400">
                  Cada decisión sobre un documento queda registrada, y cada archivo se guarda
                  cifrado. Si mañana alguien pregunta por qué esa evidencia respalda ese
                  subcriterio, la respuesta está en el sistema.
                </p>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <ul className="grid gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-2">
                {[
                  ['Cifrado AES-256', 'Los documentos se almacenan cifrados en reposo.'],
                  ['Sesión con JWT', 'Acceso autenticado y rutas protegidas de extremo a extremo.'],
                  [
                    'HTML saneado en servidor',
                    'El borrador pasa por una lista blanca de etiquetas antes de guardarse.',
                  ],
                  [
                    'Historial de auditoría',
                    'Quién validó, qué descartó y cuándo: la trazabilidad completa por documento.',
                  ],
                ].map(([title, body]) => (
                  <li key={title} className="bg-ink-900/95 p-6">
                    <p className="font-display text-base font-semibold text-stone-50">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-stone-400">{body}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Preguntas ──────────────────────────────────────────────────── */}
      <section id="preguntas" className="scroll-mt-20 border-t border-stone-900/[0.07] bg-white/45">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold-600">
              Preguntas
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">
              Lo que suelen preguntar los equipos de calidad.
            </h2>
          </Reveal>

          <div className="mt-12 divide-y divide-stone-900/10 border-y border-stone-900/10">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={i * 60}>
                <details className="faq-item group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left">
                    <span className="font-display text-lg font-semibold text-ink-900">
                      {item.q}
                    </span>
                    <span className="faq-chevron shrink-0 text-stone-400 transition-transform duration-300 group-hover:text-brand-600">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                        <path
                          d="M12 5v14M5 12h14"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </summary>
                  <p className="pb-6 pr-10 text-[15px] leading-relaxed text-stone-600">{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-5xl">
              Empieza por el Criterio 9.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
              Carga la estructura del informe, sube las primeras evidencias y observa el semáforo
              moverse. El resto del proceso se ordena solo.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link
                to={ctaHref}
                className="btn rounded-lg bg-brand-600 px-7 py-3 text-[15px] font-medium text-white shadow-soft hover:bg-brand-700 hover:shadow-lift"
              >
                {ctaLabel}
              </Link>
              <a
                href="#producto"
                className="btn rounded-lg bg-white/70 px-7 py-3 text-[15px] font-medium text-ink-800 ring-1 ring-stone-300 hover:bg-white"
              >
                Revisar funcionalidades
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Pie ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-900/[0.07]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <img src={fullLogo} alt="Qualitrack" className="h-8 w-auto" />
          <p className="text-xs text-stone-500">
            © {new Date().getFullYear()} Qualitrack · Gestión de evidencias para acreditación CNA
          </p>
          <Link to={ctaHref} className="text-sm font-medium text-brand-700 hover:text-brand-800">
            {ctaLabel} →
          </Link>
        </div>
      </footer>
    </div>
  );
}
