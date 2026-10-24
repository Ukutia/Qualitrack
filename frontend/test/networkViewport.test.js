import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitViewport, zoomViewport, panViewport } from '../src/lib/networkViewport.js';

const screen = (point, view) => ({ x: 420 + view.x + (point.x - 420) * view.scale, y: 300 + view.y + (point.y - 300) * view.scale });
test('el arrastre conserva la referencia inicial entre eventos y no depende de actualizaciones encoladas', () => {
  const view = { x: 30, y: -20, scale: 2 };
  const start = { x: 100, y: 200 };
  const first = panViewport(view, start, { x: 120, y: 180 });
  const second = panViewport(view, start, { x: 150, y: 240 });
  assert.deepEqual(first, { x: 50, y: -40, scale: 2 });
  assert.deepEqual(second, { x: 80, y: 20, scale: 2 });
  assert.deepEqual(view, { x: 30, y: -20, scale: 2 });
  assert.deepEqual(start, { x: 100, y: 200 });
});
test('el zoom conserva el punto debajo del cursor después de desplazar el mapa', () => {
  const view = { scale: 1.3, x: -120, y: 70 };
  const node = { x: 210, y: 380 };
  const anchor = screen(node, view);
  const updated = screen(node, zoomViewport(view, 1.25, anchor));
  assert.ok(Math.abs(updated.x - anchor.x) < 1e-9);
  assert.ok(Math.abs(updated.y - anchor.y) < 1e-9);
});
test('ajustar recupera nodos alejados sin modificar sus posiciones', () => {
  const nodes = [{ x: -300, y: 100 }, { x: 1200, y: 700 }];
  const view = fitViewport(nodes);
  for (const node of nodes) {
    const p = screen(node, view);
    assert.ok(p.x >= 0 && p.x <= 840 && p.y >= 0 && p.y <= 600);
  }
  assert.deepEqual(nodes[0], { x: -300, y: 100 });
});
test('la red vacía y los límites de zoom son estables', () => {
  assert.deepEqual(fitViewport([]), { x: 0, y: 0, scale: 1 });
  assert.equal(zoomViewport({ x: 0, y: 0, scale: 1 }, 100).scale, 4);
  assert.equal(zoomViewport({ x: 0, y: 0, scale: 1 }, .001).scale, .25);
});
