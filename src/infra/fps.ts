import { RingBuffer } from "../app/RingBuffer.js";

const history = new RingBuffer<number>(300);
let sum = 0;
let avg: number;
let evicted: number | undefined;

/**
 * Register a new frame and return the updated FPS.
 */
export function updateFps(dtMillis: number): number {
  sum += dtMillis;
  evicted = history.push(dtMillis);
  if (evicted !== undefined) sum -= evicted;
  avg = sum / history.count;
  return 1000 / avg;
}
