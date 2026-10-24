const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const INITIAL_VIEW = { x: 0, y: 0, scale: 1 };

export function panViewport(startView, startPoint, currentPoint) {
  return { ...startView, x: startView.x + currentPoint.x - startPoint.x, y: startView.y + currentPoint.y - startPoint.y };
}

export function zoomViewport(view, factor, anchor = { x: 420, y: 300 }) {
  const scale = clamp(view.scale * factor, .25, 4);
  const ratio = scale / view.scale;
  return { scale, x: anchor.x - 420 - (anchor.x - 420 - view.x) * ratio, y: anchor.y - 300 - (anchor.y - 300 - view.y) * ratio };
}

export function fitViewport(nodes) {
  if (!nodes.length) return { ...INITIAL_VIEW };
  const minX = Math.min(...nodes.map((n) => n.x)) - 100;
  const maxX = Math.max(...nodes.map((n) => n.x)) + 100;
  const minY = Math.min(...nodes.map((n) => n.y)) - 60;
  const maxY = Math.max(...nodes.map((n) => n.y)) + 80;
  const scale = clamp(Math.min(840 / (maxX - minX), 600 / (maxY - minY)), .25, 1.5);
  return { scale, x: (420 - (minX + maxX) / 2) * scale, y: (300 - (minY + maxY) / 2) * scale };
}
