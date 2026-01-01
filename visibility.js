import { plane, MAX_TILE_DIST } from "./setup.js";

export function getVisibleObjects(group) {
  const out = [];
  const px = plane.x;
  const py = plane.y;
  const max2 = MAX_TILE_DIST * MAX_TILE_DIST;

  for (let i = 0; i < group.length; i++) {
    const obj = group[i];
    const center = obj.center ?? obj;
    const dx = center.x - px;
    const dy = center.y - py;
    if (dx * dx + dy * dy <= max2) out.push(obj);
  }

  return out;
}
