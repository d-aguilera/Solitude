import type { RGB } from "../domain/domainPorts";

export function rgbToCss({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}
