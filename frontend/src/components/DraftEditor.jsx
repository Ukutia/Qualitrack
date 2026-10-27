import { useCallback, useEffect, useRef, useState } from 'react';

// Área de redacción del borrador. Es un `contentEditable` nativo: mantiene la
// selección de texto del navegador —de la que dependen la revisión de
// incoherencias y la inserción de frases del almacén— y cubre los formatos
// exigidos (título, negrita, cursiva, lista) sin sumar dependencias.

const TOOLS = [
  { id: 'bold',   label: 'Negrita', hint: 'Negrita (Ctrl+B)',    glyph: 'B' },
  { id: 'italic', label: 'Cursiva', hint: 'Cursiva (Ctrl+I)',    glyph: 'I' },
  { id: 'underline', label: 'Subrayado', hint: 'Subrayado (Ctrl+U)', glyph: 'U' },
  { id: 'list', label: 'Lista con viñetas', hint: 'Lista con viñetas', glyph: '☷' },
  { id: 'orderedList', label: 'Lista numerada', hint: 'Lista numerada', glyph: '1.' },
  { id: 'blockquote', label: 'Cita', hint: 'Bloque de cita', glyph: '“”' },
];

function currentBlock(root) {
  const anchor = document.getSelection()?.anchorNode;
  const element = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
  const block = element?.closest('h1, h2, h3, blockquote, p, li, div');
  if (block && block !== root && root?.contains(block)) {
    return ['DIV', 'LI'].includes(block.tagName) ? 'p' : block.tagName.toLowerCase();
  }
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

export default function DraftEditor({
  initialHtml = '',
  onChange,
  onSelectionChange,
  onOpenMatches,
  insertionRequest,
  onInsertionHandled,
  // Solo lectura (HU19): el contenido se ve, pero no se edita.
  readOnly = false,
}) {
  const ref = useRef(null);
  const wrapperRef = useRef(null);
  const [active, setActive] = useState({});
  const [block, setBlock] = useState('p');
  const [wordCount, setWordCount] = useState(0);
  // Botón flotante "Buscar coincidencias": aparece sobre el fragmento seleccionado.
  const [matchTrigger, setMatchTrigger] = useState(null); // { top, left, text }
  const selectionRangeRef = useRef(null);
  // Último cursor/selección dentro del editor: sirve para insertar texto generado
  // aunque el foco ya esté en otro botón o en un diálogo.
  const caretRangeRef = useRef(null);

  // El contenido se inyecta una sola vez: mientras se redacta, la fuente de
  // verdad es el DOM del editor. La página lo remonta (`key`) al cambiar de
  // borrador, por lo que no hace falta re-sincronizar en cada render.
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialHtml ?? '';
      setWordCount((ref.current.innerText || '').trim().split(/\s+/u).filter(Boolean).length);
    }
  }, [initialHtml]);

  const refreshActive = useCallback(() => {
    if (!ref.current || !ref.current.contains(document.getSelection()?.anchorNode ?? null)) return;
    const current = document.getSelection();
    if (current?.rangeCount) caretRangeRef.current = current.getRangeAt(0).cloneRange();
    setBlock(currentBlock(ref.current) || 'p');
    setActive({
      blockquote: currentBlock(ref.current) === 'blockquote',
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      list: document.queryCommandState('insertUnorderedList'),
      orderedList: document.queryCommandState('insertOrderedList'),
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
    if (ref.current) {
      setWordCount((ref.current.innerText || '').trim().split(/\s+/u).filter(Boolean).length);
      onChange?.(ref.current.innerHTML);
    }
  }, [onChange]);

  useEffect(() => {
    if (!insertionRequest?.id || !insertionRequest.text || !ref.current) return;
    const el = ref.current;
    const selection = document.getSelection();

    if (insertionRequest.kind === 'generated') {
      // Texto generado por la IA: párrafos normales y editables, debajo del bloque
      // donde está el cursor (o al final si el editor no tiene cursor ni contenido).
      const saved = caretRangeRef.current;
      const range = saved && el.contains(saved.commonAncestorContainer) ? saved : null;
      const paragraphs = insertionRequest.text
        .split(/\n{1,}/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const p = document.createElement('p');
          p.textContent = line;
          return p;
        });
      if (paragraphs.length === 0) return;

      let block = range ? range.endContainer : null;
      while (block && block.parentNode !== el) block = block.parentNode;
      if (block) block.after(...paragraphs);
      else el.append(...paragraphs);

      const last = paragraphs[paragraphs.length - 1];
      const caret = document.createRange();
      caret.selectNodeContents(last);
      caret.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(caret);
      caretRangeRef.current = caret.cloneRange();
      last.scrollIntoView?.({ block: 'nearest' });
      emit();
      onInsertionHandled?.(insertionRequest.id);
      return;
    }

    // Evidencia de la búsqueda semántica: reemplaza la selección guardada.
    const range = selectionRangeRef.current;
    if (!range || !el.contains(range.commonAncestorContainer)) return;

    const evidence = document.createElement('blockquote');
    evidence.textContent = insertionRequest.text;
    evidence.className = 'evidence-fragment';
    range.deleteContents();
    range.insertNode(evidence);
    range.setStartAfter(evidence);
    range.collapse(true);

    selection?.removeAllRanges();
    selection?.addRange(range);
    selectionRangeRef.current = range.cloneRange();
    emit();
    onInsertionHandled?.(insertionRequest.id);
  }, [emit, insertionRequest, onInsertionHandled]);

  function applyTool(id) {
    const el = ref.current;
    if (!el) return;
    const saved = caretRangeRef.current?.cloneRange();
    el.focus();
    if (saved && el.contains(saved.commonAncestorContainer)) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(saved);
    }

    if (['p', 'h1', 'h2', 'h3', 'blockquote'].includes(id)) {
      // `formatBlock` dentro de un <li> envuelve la lista entera en el título
      // y produce marcado inválido: primero se sale de la lista.
      if (document.queryCommandState('insertUnorderedList')) {
        document.execCommand('insertUnorderedList');
      }
      if (document.queryCommandState('insertOrderedList')) {
        document.execCommand('insertOrderedList');
      }
      document.execCommand('formatBlock', false, `<${id === 'blockquote' && currentBlock(el) === 'blockquote' ? 'p' : id}>`);
    } else if (id === 'list') {
      document.execCommand('insertUnorderedList');
    } else if (id === 'orderedList') {
      document.execCommand('insertOrderedList');
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
    <div ref={wrapperRef} className="draft-editor relative rounded-2xl bg-white ring-1 ring-stone-900/10 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <div><p className="text-sm font-semibold text-ink-900">Espacio de redacción</p><p className="mt-0.5 text-xs text-stone-500">Da forma a las ideas de tu informe</p></div>
        <span className="rounded-full bg-stone-50 px-3 py-1 text-xs text-stone-600">Edición del borrador</span>
      </div>
      <div
        role="toolbar"
        aria-label="Formato del borrador"
        className="draft-toolbar flex flex-wrap items-center gap-1 border-y border-stone-900/10 bg-stone-50/70 px-3 py-2"
      >
        <select aria-label="Estilo de párrafo" value={['p', 'h1', 'h2', 'h3'].includes(block) ? block : 'p'} onChange={(event) => applyTool(event.target.value)} className="mr-2 h-10 max-w-full rounded-lg border border-stone-200 bg-white px-2 text-sm text-stone-700">
          <option value="p">Texto normal</option><option value="h1">Título principal</option><option value="h2">Título de sección</option><option value="h3">Subtítulo</option>
        </select>
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            title={tool.hint}
            aria-label={tool.label}
            aria-pressed={active[tool.id]}
            disabled={readOnly}
            // `onMouseDown` en vez de `onClick`: evita que el botón robe el
            // foco y se pierda la selección sobre la que hay que aplicar.
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => applyTool(tool.id)}
            className={`btn grid h-10 min-w-10 place-items-center rounded-lg px-2.5 text-sm transition-colors ${
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
                    : tool.id === 'underline'
                      ? 'underline underline-offset-2'
                      : ''
              }
            >
              {tool.glyph}
            </span>
          </button>
        ))}
        <div className="ml-auto flex gap-1 border-l border-stone-200 pl-2">
          {[['undo', 'Deshacer', '↶'], ['redo', 'Rehacer', '↷']].map(([id, label, glyph]) => <button key={id} type="button" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={() => applyTool(id)} className="grid h-10 w-10 place-items-center rounded-lg text-lg text-stone-600 hover:bg-stone-100">{glyph}</button>)}
        </div>
      </div>

      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Contenido del borrador del informe"
        data-placeholder="Escriba aquí el borrador del informe…"
        onInput={emit}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onPaste={handlePaste}
        onScroll={() => setMatchTrigger(null)}
        className="draft-surface overflow-y-auto px-6 py-8 text-base leading-relaxed text-ink-900 focus:outline-none sm:px-10"
      />
      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-stone-900/10 bg-stone-50/70 px-5 py-3 text-xs text-stone-500"><span className="tabular-nums">{wordCount} {wordCount === 1 ? 'palabra' : 'palabras'}</span><span>Selecciona texto para buscar coincidencias</span></footer>

      {matchTrigger && (
        <button
          type="button"
          // `onMouseDown` con preventDefault: evita que el navegador colapse la
          // selección antes de que se dispare `onClick`.
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();

            const selectedText = matchTrigger.text;
            const selection = document.getSelection();
            selectionRangeRef.current = selection?.rangeCount
              ? selection.getRangeAt(0).cloneRange()
              : null;
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
