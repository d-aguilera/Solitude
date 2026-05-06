export interface ScreenPoint {
  x: number;
  y: number;
  depth: number; // camera-space depth (positive means in front of camera)
}

function copy(from: ScreenPoint, to: ScreenPoint): ScreenPoint {
  to.x = from.x;
  to.y = from.y;
  to.depth = from.depth;
  return to;
}

function zero(): ScreenPoint {
  return { x: 0, y: 0, depth: 0 };
}

export const scrn = {
  copy,
  zero,
};
