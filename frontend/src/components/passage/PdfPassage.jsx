import { useEffect, useMemo, useRef, useState } from 'react';
import { buildIndex, planHighlights, textNodes, applyHighlights, FOCUS_CLASS } from '../../lib/passageLocator.js';

// pdf.js pesa bastante: solo se descarga cuando se abre un PDF.
let pdfjsPromise;
function loadPdfjs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

const MAX_SCALE = 1.6;

/** Rangos a resaltar en cada página, en posiciones del índice de esa página. */
function rangesByPage(index, ranges, pageCount) {
  const counts = new Array(pageCount).fill(0);
  for (const page of index.segment) counts[page]++;

  const byPage = new Map();
  let pageStart = 0;
  counts.forEach((count, page) => {
    for (const [start, end, className] of ranges) {
      const from = Math.max(start, pageStart);
      const to = Math.min(end, pageStart + count);
      if (from >= to) continue;
      if (!byPage.has(page)) byPage.set(page, []);
      byPage.get(page).push([from - pageStart, to - pageStart, className]);
    }
    pageStart += count;
  });
  return byPage;
}

/** Páginas (base 0) que contienen el foco; sin foco, las del fragmento. */
function focusPages(byPage) {
  const withFocus = [...byPage.entries()]
    .filter(([, ranges]) => ranges.some(([, , className]) => className === FOCUS_CLASS))
    .map(([page]) => page);
  return withFocus.length ? withFocus : [...byPage.keys()];
}

function PdfPage({ pdfjs, entry, number, scale, ranges, isTarget, onMark }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '800px 0px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const holder = ref.current;
    const viewport = entry.page.getViewport({ scale });
    const ratio = window.devicePixelRatio || 1;

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    const layer = document.createElement('div');
    layer.className = 'textLayer';
    holder.replaceChildren(canvas, layer);

    const renderTask = entry.page.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
      transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null,
    });
    const textLayer = new pdfjs.TextLayer({ textContentSource: entry.textContent, container: layer, viewport });
    textLayer.render().then(() => {
      if (!ranges) return;
      const nodes = textNodes(layer);
      const index = buildIndex(nodes.map((n) => n.data));
      const marks = applyHighlights(nodes, index, ranges);
      if (!isTarget) return;
      const target = marks.find((m) => m.classList.contains(FOCUS_CLASS)) ?? marks[0];
      if (target) onMark(target);
    }).catch(() => { /* cancelado al desmontar o cambiar de escala */ });
    renderTask.promise.catch(() => {});

    return () => {
      renderTask.cancel();
      textLayer.cancel();
    };
  }, [visible, scale, entry, pdfjs, ranges, isTarget, onMark]);

  return (
    <div
      ref={ref}
      id={`pdf-page-${number}`}
      className="pdf-page"
      data-page={number}
      style={{
        width: entry.width * scale,
        height: entry.height * scale,
        '--scale-factor': scale,
        '--total-scale-factor': scale,
      }}
    />
  );
}

export default function PdfPassage({ data, passage, focus, onLocated }) {
  const containerRef = useRef(null);
  const scrolledRef = useRef(false);
  const [doc, setDoc] = useState(null);
  const [scale, setScale] = useState(null);
  const [error, setError] = useState(null);

  // Cargar y leer el texto de todas las páginas solo depende del archivo; el
  // resaltado se recalcula aparte, porque el foco llega después.
  useEffect(() => {
    let cancelled = false;
    let pdf;

    (async () => {
      const pdfjs = await loadPdfjs();
      // pdf.js transfiere el buffer a su worker: se copia para no vaciar el caché.
      pdf = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
      const pages = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const textContent = await page.getTextContent();
        const { width, height } = page.getViewport({ scale: 1 });
        if (cancelled) return;
        pages.push({ page, textContent, width, height });
      }
      const index = buildIndex(pages.map((p) => p.textContent.items.map((item) => item.str ?? '').join('')));
      if (!cancelled) setDoc({ pdfjs, pages, index });
    })().catch((err) => { if (!cancelled) setError(err); });

    return () => {
      cancelled = true;
      pdf?.destroy();
    };
  }, [data]);

  const layout = useMemo(() => {
    if (!doc) return null;
    const plan = planHighlights(doc.index, passage, focus);
    const ranges = plan ? rangesByPage(doc.index, plan.ranges, doc.pages.length) : new Map();
    const pages = focusPages(ranges);
    return { plan, ranges, pages, target: pages[0] ?? 0 };
  }, [doc, passage, focus]);

  useEffect(() => {
    if (!layout) return;
    const total = doc.pages.length;
    const { plan, pages } = layout;
    // Cambió el resaltado (por ejemplo, llegó el foco): se vuelve a centrar.
    scrolledRef.current = false;
    onLocated(plan
      ? {
        found: true,
        exact: plan.hit.exact,
        focused: plan.focused,
        label: pages.length > 1
          ? `Páginas ${pages[0] + 1}–${pages.at(-1) + 1} de ${total}`
          : `Página ${pages[0] + 1} de ${total}`,
      }
      : { found: false, label: `${total} ${total === 1 ? 'página' : 'páginas'}` });
  }, [layout, doc, onLocated]);

  // La escala se ajusta al ancho disponible, sin agrandar de más.
  useEffect(() => {
    if (!doc) return undefined;
    const widest = Math.max(...doc.pages.map((p) => p.width));
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.min(MAX_SCALE, (entry.contentRect.width - 2) / widest);
      setScale((prev) => (prev && Math.abs(prev - next) < 0.02 ? prev : next));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [doc]);

  // Primero se lleva la página del foco a la vista (así se renderiza) y
  // después, cuando aparece el resaltado, se centra el resaltado.
  useEffect(() => {
    if (layout && scale && !scrolledRef.current) {
      document.getElementById(`pdf-page-${layout.target + 1}`)?.scrollIntoView({ block: 'start' });
    }
  }, [layout, scale]);

  const onMark = useRef((mark) => {
    if (scrolledRef.current) return;
    scrolledRef.current = true;
    mark.scrollIntoView({ block: 'center' });
  }).current;

  if (error) return <p role="alert" className="p-6 text-sm text-rose-600">No fue posible abrir el PDF.</p>;

  return (
    <div ref={containerRef} className="pdf-viewer">
      {!doc && <p role="status" className="p-6 text-sm text-stone-500">Buscando el fragmento en el PDF…</p>}
      {layout && scale && doc.pages.map((entry, i) => (
        <PdfPage
          key={i}
          pdfjs={doc.pdfjs}
          entry={entry}
          number={i + 1}
          scale={scale}
          ranges={layout.ranges.get(i)}
          isTarget={i === layout.target}
          onMark={onMark}
        />
      ))}
    </div>
  );
}
