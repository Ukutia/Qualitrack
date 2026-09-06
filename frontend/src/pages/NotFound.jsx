import { Link } from 'react-router-dom';
import useDocumentMeta from '../lib/useDocumentMeta.js';

/* Cualquier ruta no reconocida caía en un render vacío: la SPA no montaba nada
   y el visitante quedaba frente a una pantalla en blanco, sin forma de volver. */
export default function NotFound() {
  useDocumentMeta({
    title: 'Página no encontrada',
    description: 'La página que buscas no existe o cambió de dirección.',
  });

  return (
    <main className="grid min-h-full place-items-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="font-display text-6xl font-semibold text-brand-700 tnum">404</p>
        <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-ink-900">
          Esta página no existe.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-steel-600">
          El enlace puede estar mal escrito o la sección pudo haber cambiado de nombre. Desde el
          inicio llegas a todo lo demás.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="btn rounded-lg bg-brand-600 px-6 py-3 text-[15px] font-medium text-white shadow-soft hover:bg-brand-700 hover:shadow-lift"
          >
            Volver al inicio
          </Link>
          <Link
            to="/login"
            className="btn rounded-lg bg-white/70 px-6 py-3 text-[15px] font-medium text-ink-800 ring-1 ring-steel-300 hover:bg-white"
          >
            Entrar a la plataforma
          </Link>
        </div>
      </div>
    </main>
  );
}
