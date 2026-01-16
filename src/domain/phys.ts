import { NEWTON_G } from "./domainInternals.js";

// Sun mass
const M_sun = 1.98847e30; // kg

export function circularSpeedAtRadius(r: number): number {
  // v = sqrt(G * M_sun / r)
  return Math.sqrt((NEWTON_G * M_sun) / r);
}
