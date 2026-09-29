import { useEffect, useRef, useState } from 'react';
import {
  buildIndex, planHighlights, textNodes, applyHighlights, FOCUS_CLASS, CONTEXT_CLASS,
} from '../../lib/passageLocator.js';

// Encabezados y pies se repiten en cada página y no forman parte del texto
// extraído por mammoth: incluirlos cortaría el fragmento entre páginas.
const outsideBody = (node) => !!node.parentElement?.closest('header, footer');

/** Quita marcas previas y vuelve a unir el texto que dividieron. */
function clearMarks(root) {
  const parents = new Set();
  root.querySelectorAll(`mark.${FOCUS_CLASS}, mark.${CONTEXT_CLASS}`).forEach((mark) => {
    parents.add(mark.parentNode);
    mark.replaceWith(...mark.childNodes);
  });
  parents.forEach((parent) => parent.normalize());
}

export default function DocxPassage({ data, passage, focus, onLocated }) {
  const bodyRef = useRef(null);
  const styleRef = useRef(null);
  const [state, setState] = useState('loading');

  // Renderizar el Word depende solo del archivo; el resaltado va aparte porque
  // el foco llega después.
  useEffect(() => {
    let cancelled = false;
    setState('loading');

    (async () => {
      const { renderAsync } = await import('docx-preview');
      await renderAsync(new Blob([data]), bodyRef.current, styleRef.current, {
        className: 'docx',
        inWrapper: true,
        breakPages: true,
        // Word guarda dónde cortó cada página al último guardado: respetarlo
        // hace que la numeración coincida con la del documento original.
        ignoreLastRenderedPageBreak: false,
        renderHeaders: true,
        renderFooters: true,
        useBase64URL: true,
      });
      if (!cancelled) setState('ready');
    })().catch(() => { if (!cancelled) setState('error'); });

    return () => { cancelled = true; };
  }, [data]);

  useEffect(() => {
    if (state !== 'ready') return;
    const body = bodyRef.current;
    clearMarks(body);

    const pages = [...body.querySelectorAll('section.docx')];
    const nodes = textNodes(body, outsideBody);
    const index = buildIndex(nodes.map((n) => n.data));
    const plan = planHighlights(index, passage, focus);
    const marks = plan ? applyHighlights(nodes, index, plan.ranges) : [];
    const focused = marks.filter((m) => m.classList.contains(FOCUS_CLASS));
    const shown = focused.length ? focused : marks;

    if (!shown.length) {
      onLocated({ found: false, label: `${pages.length} ${pages.length === 1 ? 'página' : 'páginas'}` });
      return;
    }
    const first = pages.indexOf(shown[0].closest('section.docx')) + 1;
    const last = pages.indexOf(shown.at(-1).closest('section.docx')) + 1;
    onLocated({
      found: true,
      exact: plan.hit.exact,
      focused: plan.focused,
      label: last > first
        ? `Páginas ${first}–${last} de ${pages.length}`
        : `Página ${first} de ${pages.length}`,
    });
    shown[0].scrollIntoView({ block: 'center' });
  }, [state, passage, focus, onLocated]);

  return (
    <div className="docx-viewer">
      {state === 'loading' && <p role="status" className="p-6 text-sm text-stone-500">Buscando el fragmento en el documento…</p>}
      {state === 'error' && <p role="alert" className="p-6 text-sm text-rose-600">No fue posible abrir el documento Word.</p>}
      <div ref={styleRef} hidden />
      <div ref={bodyRef} />
    </div>
  );
}
