import type { RGB } from "../app/scenePorts";

export function rgbToCss({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

const RGB_CACHE_SIZE = 1 << 15; // 32^3
const rgbCssCache: Array<string | undefined> = new Array(RGB_CACHE_SIZE);

/**
 * Convert RGB to CSS using a cached 5-bit-per-channel quantized palette.
 * This avoids per-frame string allocations in hot render paths.
 */
export function rgbToQuantizedCss({ r, g, b }: RGB): string {
  const qr = (r & 0xff) >> 3; // to 5 bits
  const qg = (g & 0xff) >> 3; // to 5 bits
  const qb = (b & 0xff) >> 3; // to 5 bits
  const key = (qr << 10) | (qg << 5) | qb;

  let cached = rgbCssCache[key];
  if (cached) return cached;

  const rr = (qr << 3) | (qr >> 2); // back to 8 bits
  const gg = (qg << 3) | (qg >> 2); // back to 8 bits
  const bb = (qb << 3) | (qb >> 2); // back to 8 bits
  cached = `rgb(${rr}, ${gg}, ${bb})`;
  rgbCssCache[key] = cached;
  return cached;
}
