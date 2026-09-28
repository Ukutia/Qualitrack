import { useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentSheets } from '../../hooks/useApi.js';
import { buildIndex, planHighlights, CSV_IGNORED, FOCUS_CLASS } from '../../lib/passageLocator.js';

function columnName(n) {
  let name = '';
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) name = String.fromCharCode(65 + ((i - 1) % 26)) + name;
  return name;
}

const cellKey = (sheet, row, col) => `${sheet}:${row}:${col}`;

// Solo se dibuja una ventana de filas: una planilla de miles de filas por
// decenas de columnas deja la página inutilizable si se dibuja entera.
const ROW_WINDOW = 300;
const ROWS_BEFORE_TARGET = 60;

/**
 * Reproduce el orden del texto extraído ("# Hoja" y luego el CSV fila a fila)
 * para saber qué celdas cubre el fragmento.
 */
function locateCells(sheets, passage, focus) {
  const segments = [];
  const cells = [];
  sheets.forEach((sheet, s) => {
    segments.push(`# ${sheet.name}`);
    cells.push(null);
    sheet.rows.forEach((row, r) => row.forEach((value, c) => {
      segments.push(value);
      cells.push({ sheet: s, row: r, col: c });
    }));
  });

  const index = buildIndex(segments, CSV_IGNORED);
  const plan = planHighlights(index, passage, focus, CSV_IGNORED);
  if (!plan) return null;

  // Celdas del fragmento (contexto) y celdas del foco (las relacionadas con la
  // temática); la primera del foco es la que se señala y se lleva a la vista.
  const marked = new Set();
  const focused = new Set();
  let first = null;
  let firstMarked = null;
  for (const [start, end, className] of plan.ranges) {
    for (let k = start; k < end; k++) {
      const cell = cells[index.segment[k]];
      if (!cell) continue;
      const key = cellKey(cell.sheet, cell.row, cell.col);
      marked.add(key);
      firstMarked ??= cell;
      if (className === FOCUS_CLASS) {
        first ??= cell;
        focused.add(key);
      }
    }
  }
  // Mientras el foco se calcula, se señala la celda donde empieza el fragmento.
  first ??= firstMarked;
  return first ? { first, marked, focused, exact: plan.hit.exact, isFocused: plan.focused } : null;
}

export default function SheetPassage({ documentId, passage, focus, onLocated }) {
  const sheets = useDocumentSheets(documentId, true);
  const [active, setActive] = useState(0);
  const [view, setView] = useState({ start: 0, end: ROW_WINDOW });
  const targetRef = useRef(null);

  const location = useMemo(
    () => (sheets.data ? locateCells(sheets.data.sheets, passage, focus) : null),
    [sheets.data, passage, focus],
  );

  useEffect(() => {
    if (!sheets.data) return;
    const list = sheets.data.sheets;
    if (!location) {
      onLocated({ found: false, label: `${list.length} ${list.length === 1 ? 'hoja' : 'hojas'}` });
      return;
    }
    const { first, focused } = location;
    const sheet = list[first.sheet];
    const address = `${columnName(sheet.firstCol + first.col)}${sheet.firstRow + first.row + 1}`;
    const others = Math.max(0, [...focused].filter((key) => key.startsWith(`${first.sheet}:`)).length - 1);
    setActive(first.sheet);
    const start = Math.max(0, first.row - ROWS_BEFORE_TARGET);
    setView({ start, end: start + ROW_WINDOW });
    onLocated({
      found: true,
      exact: location.exact,
      focused: location.isFocused,
      label: `Hoja «${sheet.name}» · celda ${address}${others > 0 ? ` (+${others} ${others === 1 ? 'celda' : 'celdas'})` : ''}`,
    });
  }, [sheets.data, location, onLocated]);

  useEffect(() => {
    targetRef.current?.scrollIntoView({ block: 'center', inline: 'center' });
  }, [location, active]);

  if (sheets.isPending) return <p role="status" className="p-6 text-sm text-stone-500">Cargando la planilla…</p>;
  if (sheets.isError) return <p role="alert" className="p-6 text-sm text-rose-600">No fue posible abrir la planilla.</p>;

  const list = sheets.data.sheets;
  const sheet = list[active];
  const width = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0);
  const start = Math.min(view.start, sheet.rows.length);
  const end = Math.min(view.end, sheet.rows.length);
  const rowLabel = (r) => sheet.firstRow + r + 1;

  return (
    <div className="sheet-viewer">
      {list.length > 1 && (
        <div role="tablist" aria-label="Hojas" className="sheet-tabs">
          {list.map((s, i) => (
            <button
              key={s.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => {
                setActive(i);
                const start = location?.first.sheet === i ? Math.max(0, location.first.row - ROWS_BEFORE_TARGET) : 0;
                setView({ start, end: start + ROW_WINDOW });
              }}
              className="sheet-tab"
            >
              {s.name}
              {location?.first.sheet === i && <span className="sheet-tab-dot" aria-label="contiene el fragmento" />}
            </button>
          ))}
        </div>
      )}

      {sheets.data.truncated && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          La planilla es muy grande: solo se muestran sus primeras filas.
        </p>
      )}

      {start > 0 && (
        <button type="button" className="sheet-more" onClick={() => setView((v) => ({ ...v, start: Math.max(0, v.start - ROW_WINDOW) }))}>
          Mostrar filas anteriores (desde la {rowLabel(Math.max(0, start - ROW_WINDOW))})
        </button>
      )}

      <div className="sheet-scroll">
        {sheet.rows.length === 0 ? (
          <p className="p-6 text-sm text-stone-500">Esta hoja está vacía.</p>
        ) : (
          <table className="sheet-table">
            <thead>
              <tr>
                <th aria-hidden="true" />
                {Array.from({ length: width }, (_, c) => <th key={c} scope="col">{columnName(sheet.firstCol + c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.slice(start, end).map((row, i) => { const r = start + i; return (
                <tr key={r}>
                  <th scope="row">{rowLabel(r)}</th>
                  {Array.from({ length: width }, (_, c) => {
                    const isFirst = location?.first.sheet === active && location.first.row === r && location.first.col === c;
                    const key = cellKey(active, r, c);
                    const isFocus = location?.focused.has(key);
                    const isMarked = location?.marked.has(key);
                    return (
                      <td
                        key={c}
                        ref={isFirst ? targetRef : undefined}
                        className={isFirst ? 'sheet-cell-target' : isFocus ? 'sheet-cell-focus' : isMarked ? 'sheet-cell-marked' : undefined}
                        aria-current={isFirst ? 'location' : undefined}
                      >
                        {row[c] ?? ''}
                      </td>
                    );
                  })}
                </tr>
              ); })}
            </tbody>
          </table>
        )}
      </div>

      {end < sheet.rows.length && (
        <button type="button" className="sheet-more" onClick={() => setView((v) => ({ ...v, end: v.end + ROW_WINDOW }))}>
          Mostrar más filas ({sheet.rows.length - end} restantes)
        </button>
      )}
    </div>
  );
}
