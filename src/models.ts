import type { Model } from "./types.js";

export const AIRPLANE = "AIRPLANE";

export const airplaneModel: Model = {
  objectType: AIRPLANE,
  points: [
    { x: 0, y: 0.5, z: 0 },
    { x: 0, y: 0.1, z: 0.15 },
    { x: -0.1, y: 0, z: 0 },
    { x: 0.1, y: 0, z: 0 },
    { x: 0, y: 0, z: -0.1 },
    { x: 0, y: -0.5, z: 0 },
    { x: -0.5, y: -0.3, z: 0 },
    { x: 0.5, y: -0.3, z: 0 },
    { x: 0, y: -0.5, z: 0.3 },
  ],
  lines: [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
    [1, 2, 4, 3],
    [2, 6, 5],
    [3, 7, 5],
    [1, 8, 5],
  ],
  color: { r: 0, g: 255, b: 255 },
  lineWidth: 1,
};
