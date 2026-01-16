import { NEWTON_G } from "./domainInternals.js";

export function circularSpeedAtRadius(mass: number, r: number): number {
  // v = sqrt(G * M / r)
  return Math.sqrt((NEWTON_G * mass) / r);
}
