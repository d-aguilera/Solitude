import { DrawMode } from "./types";

// Canvas dimensions in pixels.
export const WIDTH = 850;
export const HEIGHT = 900;

// Field of view in degrees for perspective projection.
export const FIELD_OF_VIEW = 90;

// Precomputed focal length from the field of view.
export const FOCAL_LENGTH = 1 / Math.tan((FIELD_OF_VIEW * Math.PI) / 180 / 2);

export const DRAW_MODE: DrawMode = "faces";
