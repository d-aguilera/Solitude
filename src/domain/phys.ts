import { parameters } from "../global/parameters";

export function circularSpeedAtRadius(mass: number, r: number): number {
  // v = sqrt(G * M / r)
  return Math.sqrt((parameters.newtonG * mass) / r);
}
