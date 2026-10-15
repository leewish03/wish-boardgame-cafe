// Resolve visible objects first; overlapping enlarged touch regions require an explicit choice.
export function mapHitChoices(items, point, screenUnit) {
  const distance = item => Math.hypot(item.x - point.x, item.y - point.y);
  const nearby = items.filter(item => distance(item) <= Math.max(item.radius, 22 * screenUnit));
  const painted = nearby.filter(item => distance(item) <= item.radius);
  return painted.length === 1 ? painted : nearby;
}

export function revealMapPoint(view, point, screenUnit) {
  if (!point) return view;
  const margin = 24 * screenUnit;
  if (point.x >= view.x + margin && point.x <= view.x + view.w - margin && point.y >= view.y + margin && point.y <= view.y + view.h - margin) return view;
  return { ...view, x: point.x - view.w / 2, y: point.y - view.h / 2 };
}
