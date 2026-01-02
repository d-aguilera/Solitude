// Centralized configuration for render-related constants that need to be
// shared across setup and drawing code without introducing circular or
// unnecessary dependencies.

// Canvas dimensions in pixels.
export const HEIGHT = 600;
export const WIDTH = 600;

// Field of view in degrees for perspective projection.
export const FIELD_OF_VIEW = 90;

// Precomputed focal length from the field of view.
export const FOCAL_LENGTH = 1 / Math.tan((FIELD_OF_VIEW * Math.PI) / 180 / 2);
