import { useEffect } from 'react';

const BASE_TITLE = 'Qualitrack';

/**
 * Ajusta `<title>` y la meta description de la ruta actual.
 *
 * La app es una SPA sin renderizado en servidor, así que todas las rutas
 * heredaban el título del `index.html`. Esto no reemplaza al SSR para los
 * rastreadores que no ejecutan JS, pero sí corrige el historial del navegador,
 * las pestañas, los marcadores y los buscadores que sí lo ejecutan.
 */
export default function useDocumentMeta({ title, description }) {
  useEffect(() => {
    if (title) document.title = `${title} — ${BASE_TITLE}`;

    if (!description) return;
    const tag = document.querySelector('meta[name="description"]');
    if (!tag) return;
    const previous = tag.getAttribute('content');
    tag.setAttribute('content', description);
    return () => tag.setAttribute('content', previous);
  }, [title, description]);
}
