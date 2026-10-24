import { useEffect, useReducer, useRef, useState } from 'react';
import { INITIAL_VIEW, zoomViewport, fitViewport, panViewport } from '../lib/networkViewport.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function NetworkCanvas({ layout, topicId, documentId, onSelect }) {
  const svg = useRef(null);
  const world = useRef(null);
  const nodes = useRef([]);
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const [, redraw] = useReducer((v) => v + 1, 0);
  const [view, setView] = useState(INITIAL_VIEW);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    nodes.current = layout.nodes.map((n) => ({ ...n, homeX: n.x, homeY: n.y, vx: 0, vy: 0 }));
    gesture.current = null;
    redraw();
  }, [layout]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => { if (preference.matches) setRunning(false); };
    preference.addEventListener('change', changed);
    return () => preference.removeEventListener('change', changed);
  }, []);

  // Animate only this canvas, never the reader or the API queries. Springs
  // keep the layout stable while giving dragging a soft, connected response.
  useEffect(() => {
    if (!running) return;
    let frame, previous = 0;
    function tick(now) {
      frame = requestAnimationFrame(tick);
      if (document.hidden || now - previous < 32) return;
      previous = now;
      const byKey = new Map(nodes.current.map((n) => [n.key, n]));
      for (const [i, n] of nodes.current.entries()) {
        if (gesture.current?.key === n.key) continue;
        const phase = now / 2200 + i * 1.7;
        n.vx = (n.vx + (n.homeX + Math.sin(phase) * 5 - n.x) * .025) * .8;
        n.vy = (n.vy + (n.homeY + Math.cos(phase * .8) * 5 - n.y) * .025) * .8;
      }
      for (const edge of layout.edges) {
        const a = byKey.get(edge.source.key), b = byKey.get(edge.target.key);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const rest = Math.hypot(b.homeX - a.homeX, b.homeY - a.homeY);
        const force = clamp((distance - rest) * .008, -2, 2);
        if (gesture.current?.key !== a.key) { a.vx += dx / distance * force; a.vy += dy / distance * force; }
        if (gesture.current?.key !== b.key) { b.vx -= dx / distance * force; b.vy -= dy / distance * force; }
      }
      nodes.current.forEach((n) => {
        if (gesture.current?.key !== n.key) { n.x += clamp(n.vx, -6, 6); n.y += clamp(n.vy, -6, 6); }
      });
      redraw();
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, layout]);

  function point(event, element = svg.current) {
    const matrix = element?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  }

  function zoom(factor, anchor = { x: 420, y: 300 }) {
    setView((v) => zoomViewport(v, factor, anchor));
  }

  function fit(items = nodes.current) {
    setView(fitViewport(items));
  }

  useEffect(() => { fit(nodes.current); }, [layout]);

  useEffect(() => {
    const element = svg.current;
    const wheel = (event) => {
      event.preventDefault();
      const anchor = point(event);
      if (event.ctrlKey || event.metaKey) {
        if (anchor) zoom(Math.exp(-clamp(event.deltaY, -100, 100) * .008), anchor);
      } else {
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
        const matrix = element.getScreenCTM();
        if (!matrix) return;
        const dx = (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * unit;
        const dy = (event.shiftKey && !event.deltaX ? 0 : event.deltaY) * unit;
        setView((v) => ({ ...v, x: v.x - dx / matrix.a, y: v.y - dy / matrix.d }));
      }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);

  function start(event) {
    if (event.button !== 0 || gesture.current) return;
    const clickedKey = event.target.closest('[data-node]')?.dataset.node;
    const key = clickedKey;
    const p = point(event, key ? world.current : svg.current);
    if (!p) return;
    const node = nodes.current.find((n) => n.key === key);
    event.preventDefault();
    gesture.current = { key, clickedKey, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: p.x, y: p.y, viewStart: { ...view }, offsetX: node ? node.x - p.x : 0, offsetY: node ? node.y - p.y : 0, moved: false };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.pointerId) return;
    if (Math.hypot(event.clientX - g.startX, event.clientY - g.startY) > 4) g.moved = true;
    if (!g.moved) return;
    setDragging(true);
    setHover(null);
    const p = point(event, g.key ? world.current : svg.current);
    if (!p) return;
    if (g.key) {
      const n = nodes.current.find((item) => item.key === g.key);
      if (n) { n.x = p.x + g.offsetX; n.y = p.y + g.offsetY; n.vx = 0; n.vy = 0; redraw(); }
    } else {
      // Use the immutable starting view. Reading g.x/g.y inside a queued
      // updater after changing them can turn the movement delta into zero.
      setView(panViewport(g.viewStart, g, p));
    }
  }

  function end(event) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.pointerId) return;
    const n = nodes.current.find((item) => item.key === g.key);
    if (n && g.moved) { n.homeX = n.x; n.homeY = n.y; }
    suppressClick.current = g.moved;
    gesture.current = null;
    setDragging(false);
    if (svg.current.hasPointerCapture(event.pointerId)) svg.current.releasePointerCapture(event.pointerId);
    // Pointer capture retargets clicks to the canvas, so selection is handled
    // here too. Dragging never opens a document accidentally.
    const clicked = nodes.current.find((item) => item.key === g.clickedKey);
    if (clicked && !g.moved && event.type === 'pointerup') onSelect(clicked);
    redraw();
  }

  const rendered = nodes.current.length ? nodes.current : layout.nodes;
  const byKey = new Map(rendered.map((n) => [n.key, n]));
  const focus = hover || (documentId ? `d${documentId}` : topicId ? `t${topicId}` : null);
  const neighborhood = new Set(focus ? [focus] : []);
  layout.edges.forEach((e) => {
    if (e.source.key === focus || e.target.key === focus) { neighborhood.add(e.source.key); neighborhood.add(e.target.key); }
  });

  return <div className={`network-canvas ${running ? 'is-running' : ''}`}>
    <svg ref={svg} viewBox="0 0 840 600" className={`network-svg ${dragging ? 'is-dragging' : ''}`} aria-label="Red interactiva: arrastra un nodo para moverlo o el fondo para desplazar el mapa. Un clic abre el documento." onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onPointerLeave={() => setHover(null)} onDoubleClick={(e) => { if (!e.target.closest('[data-node]')) fit(); }}>
      <rect width="840" height="600" fill="transparent" pointerEvents="all" />
      <g ref={world} transform={`translate(${420 + view.x} ${300 + view.y}) scale(${view.scale}) translate(-420 -300)`}>
        {layout.edges.map((e) => {
          const a = byKey.get(e.source.key), b = byKey.get(e.target.key);
          if (!a || !b) return null;
          const active = e.source.key === focus || e.target.key === focus;
          return <line key={`${e.topicId}:${e.documentId}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`network-edge ${active ? 'network-edge-active' : ''}`} stroke={active ? '#3778bd' : '#b8cce2'} strokeWidth={active ? 2.5 : 1.2} opacity={focus && !active ? .12 : .6} />;
        })}
        {rendered.map((n) => {
          const isTopic = n.type === 'topic', selected = isTopic ? topicId === n.id : documentId === n.id;
          const radius = isTopic ? 24 + Math.min(14, Math.sqrt(n.connections) * 3) : 15;
          return <g key={n.key} data-node={n.key} role="button" tabIndex={0} aria-label={`${isTopic ? 'Temática' : 'Documento'}: ${n.name}${isTopic ? `, ${n.connections} conexiones` : ''}`} aria-pressed={selected} className="network-node" transform={`translate(${n.x} ${n.y})`} opacity={focus && !neighborhood.has(n.key) ? .35 : 1} onPointerEnter={() => setHover(n.key)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(n.key)} onBlur={() => setHover(null)} onClick={(e) => { if (e.detail === 0 && !suppressClick.current) onSelect(n); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n); } }}>
            <title>{n.name}</title>
            <circle r={radius + 9} fill="transparent" />
            {(selected || hover === n.key) && <circle r={radius + 6} fill="none" stroke={selected ? '#ca9341' : '#78adb7'} strokeWidth="2" />}
            {isTopic ? <circle r={radius} fill={n.connections ? '#3778bd' : '#fff7eb'} stroke={n.connections ? '#d8ebfb' : '#b3853d'} strokeWidth="3" strokeDasharray={!n.connections ? '4 3' : undefined} /> : <><rect x={-radius} y={-radius} width={radius * 2} height={radius * 2} rx="8" fill={selected ? '#e8f2fc' : '#fff'} stroke={selected ? '#3778bd' : '#97b9d9'} strokeWidth="1.8" /><path d="M-5-7h6l4 4v10H-5ZM1-7v4h4M-2 1h4M-2 4h4" fill="none" stroke="#3778bd" strokeWidth="1.3" strokeLinejoin="round" /></>}
            {isTopic && <text y="5" textAnchor="middle" fill={n.connections ? 'white' : '#8b622e'} fontSize="13" fontWeight="600">{n.connections}</text>}
            {(isTopic || selected || hover === n.key || gesture.current?.key === n.key) && <text y={radius + 19} textAnchor="middle" className="network-label">{n.name.length > 36 ? `${n.name.slice(0, 34)}…` : n.name}</text>}
          </g>;
        })}
      </g>
    </svg>
    <div className="network-map-footer"><div className="network-legend"><span><i className="legend-topic" />Temática</span><span><i className="legend-document" />Documento</span><span><i className="legend-gap" />Sin evidencia</span></div><div className="network-zoom-controls"><button aria-label="Alejar" onClick={() => zoom(.8)}>−</button><span className="network-zoom-level">{Math.round(view.scale * 100)}%</span><button aria-label="Acercar" onClick={() => zoom(1.25)}>+</button><button onClick={() => fit()}>Ajustar red</button></div></div>
    <div className="network-bottom-bar"><p className="network-hint">Arrastra un nodo para moverlo o el fondo para desplazar el mapa. Un clic abre el documento. Ctrl/⌘ + rueda: zoom.</p><button type="button" role="switch" aria-checked={running} aria-label="Animación de la red" onClick={() => setRunning((value) => !value)} className="network-animation-toggle"><svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m2 11 4-5 4 8 4-8 4 5" strokeLinecap="round" strokeLinejoin="round" /></svg><span>Animación</span><span className="network-toggle-track" aria-hidden="true"><span /></span></button></div>
  </div>;
}
