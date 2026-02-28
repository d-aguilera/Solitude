import type { RGB } from "../app/appPorts.js";

export const colors: { [key: string]: RGB } = {
  ship: { r: 0, g: 255, b: 255 },
  earth: { r: 80, g: 120, b: 255 },
  jupiter: { r: 220, g: 180, b: 120 },
  mars: { r: 255, g: 80, b: 50 },
  mercury: { r: 180, g: 180, b: 180 },
  neptune: { r: 80, g: 120, b: 255 },
  saturn: { r: 220, g: 200, b: 150 },
  sun: { r: 255, g: 230, b: 120 },
  uranus: { r: 160, g: 220, b: 240 },
  venus: { r: 255, g: 220, b: 160 },
  yellow: { r: 255, g: 255, b: 0 },
  moon: { r: 210, g: 210, b: 210 },
};
