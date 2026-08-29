import { useCallback, useEffect, useRef, useState } from 'react';

// Área de redacción del borrador. Es un `contentEditable` nativo: mantiene la
// selección de texto del navegador —de la que dependen la revisión de
// incoherencias y la inserción de frases del almacén— y cubre los formatos
// exigidos (título, negrita, cursiva, lista) sin sumar dependencias.

const TOOLS = [
  { id: 'h2',     label: 'Título',  hint: 'Título de sección',   glyph: 'H' },
  { id: 'bold',   label: 'Negrita', hint: 'Negrita (Ctrl+B)',    glyph: 'B' },
  { id: 'italic', label: 'Cursiva', hint: 'Cursiva (Ctrl+I)',    glyph: 'I' },
  { id: 'list',   label: 'Lista',   hint: 'Lista con viñetas',   glyph: '•' },
];

function currentBlock() {
  const value = document.queryCommandValue('formatBlock');
  return (value || '').toString().toLowerCase().replace(/[<>]/g, '');
}

// `insertUnorderedList` sobre un título produce <h2><ul>…</ul></h2>: marcado
// inválido que el navegador reordena al reabrir el borrador, cambiando lo que
// el usuario ve. Se saca la lista de su contenedor en el momento.
function unwrapMisplacedLists(root) {
  const selector = ['h1', 'h2', 'h3', 'p']
    .flatMap((block) => [`${block} > ul`, `${block} > ol`])
    .join(', ');

  for (const list of root.querySelectorAll(selector)) {
    const wrapper = list.parentNode;
    wrapper.parentNode.insertBefore(list, wrapper);
    if (!wrapper.textContent.trim()) wrapper.remove();
  }
}

export default function DraftEditor({ initialHtml = '', onChange, onSelectionChange, onOpenMatches }) {
  const ref = useRef(null);
  const wrapperRef = useRef(null);
  const [active, setActive] = useState({ h2: false, bold: false, italic: false, list: false });
  // Botón flotante "Buscar coincidencias": aparece sobre el fragmento seleccionado.
  const [matchTrigger, setMatchTrigger] = useState(null); // { top, left, text }

  // El contenido se inyecta una sola vez: mientras se redacta, la fuente de
  // verdad es el DOM del editor. La página lo remonta (`key`) al cambiar de
  // borrador, por lo que no hace falta re-sincronizar en cada render.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshActive = useCallback(() => {
    if (!ref.current || !ref.current.contains(document.getSelection()?.anchorNode ?? null)) return;
    setActive({
      h2: currentBlock() === 'h2',
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      list: document.queryCommandState('insertUnorderedList'),
    });
    onSelectionChange?.(document.getSelection()?.toString() ?? '');
  }, [onSelectionChange]);

  const updateMatchTrigger = useCallback(() => {
    const el = ref.current;
    const wrapper = wrapperRef.current;
    const sel = document.getSelection();
    if (
      !el || !wrapper || !sel || sel.isCollapsed || !sel.toString().trim() ||
      !el.contains(sel.anchorNode)
    ) {
      setMatchTrigger(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    setMatchTrigger({
      top: rect.top - wrapperRect.top,
      left: rect.left - wrapperRect.left + rect.width / 2,
      text: sel.toString(),
    });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateMatchTrigger);
    return () => document.removeEventListener('selectionchange', updateMatchTrigger);
  }, [updateMatchTrigger]);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshActive);
    return () => document.removeEventListener('selectionchange', refreshActive);
  }, [refreshActive]);

  const emit = useCallback(() => {
    if (ref.current) onChange?.(ref.current.innerHTML);
  }, [onChange]);

  function applyTool(id) {
    const el = ref.current;
    if (!el) return;
    el.focus();

    if (id === 'h2') {
      // `formatBlock` dentro de un <li> envuelve la lista entera en el título
      // y produce marcado inválido: primero se sale de la lista.
      if (document.queryCommandState('insertUnorderedList')) {
        document.execCommand('insertUnorderedList');
      }
      if (document.queryCommandState('insertOrderedList')) {
        document.execCommand('insertOrderedList');
      }
      document.execCommand('formatBlock', false, currentBlock() === 'h2' ? '<p>' : '<h2>');
    } else if (id === 'list') {
      document.execCommand('insertUnorderedList');
    } else {
      document.execCommand(id);
    }

    unwrapMisplacedLists(el);
    refreshActive();
    emit();
  }

  // Se pega como texto plano: el marcado externo (Word, web) se descarta en el
  // servidor de todos modos, y así el borrador no arrastra estilos ajenos.
  function handlePaste(event) {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    emit();
  }

  return (
    <div ref={wrapperRef} className="relative rounded-2xl bg-white ring-1 ring-stone-900/10 shadow-sm">
      <div
        role="toolbar"
        aria-label="Formato del borrador"
        className="flex items-center gap-1 rounded-t-2xl border-b border-stone-900/10 bg-stone-50/70 px-3 py-2"
      >
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            title={tool.hint}
            aria-label={tool.label}
            aria-pressed={active[tool.id]}
            // `onMouseDown` en vez de `onClick`: evita que el botón robe el
            // foco y se pierda la selección sobre la que hay que aplicar.
            onMouseDown={(e) => {
              e.preventDefault();
              applyTool(tool.id);
            }}
            className={`btn grid h-8 min-w-8 place-items-center rounded-lg px-2.5 text-sm ring-1 transition-colors ${
              active[tool.id]
                ? 'bg-ink-700 text-stone-50 ring-ink-700'
                : 'bg-white text-stone-600 ring-stone-900/10 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <span
              className={
                tool.id === 'bold'
                  ? 'font-bold'
                  : tool.id === 'italic'
                    ? 'italic font-serif'
                    : tool.id === 'h2'
                      ? 'font-display font-semibold'
                      : ''
              }
            >
              {tool.glyph}
            </span>
          </button>
        ))}
        <span className="ml-auto text-[11px] uppercase tracking-[0.18em] text-stone-400">
          Borrador
        </span>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Contenido del borrador del informe"
        data-placeholder="Escriba aquí el borrador del informe…"
        onInput={emit}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onPaste={handlePaste}
        className="draft-surface min-h-[26rem] max-h-[60vh] overflow-y-auto rounded-b-2xl px-7 py-6 text-[15px] leading-relaxed text-ink-900 focus:outline-none"
      />

      {matchTrigger && (
        <button
          type="button"
          // `onMouseDown` con preventDefault: evita que el navegador colapse la
          // selección antes de que se dispare `onClick`.
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();

            const selectedText = matchTrigger.text;
            onOpenMatches?.(selectedText);
            setMatchTrigger(null);
          }}
          className="btn absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1.5 whitespace-nowrap rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-ink-800"
          style={{ top: matchTrigger.top - 8, left: matchTrigger.left }}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          Buscar coincidencias
        </button>
      )}
    </div>
  );
}
