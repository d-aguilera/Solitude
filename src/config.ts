import { DrawMode } from "./types";

// Horizontal field of view in degrees for perspective projection.
const HORIZONTAL_FOV = 90;

// fX = 1 / tan(HFOV / 2)
export const HORIZONTAL_FOCAL_LENGTH =
  1 / Math.tan((HORIZONTAL_FOV * Math.PI) / 180 / 2);

export const DRAW_MODE: DrawMode = "faces";
