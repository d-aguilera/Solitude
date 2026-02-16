import { RingBuffer } from "../app/RingBuffer.js";

const history = new RingBuffer<number>(300);
let sum = 0;

/**
 * Register a new frame and return the updated FPS.
 */
export function updateFps(dtSeconds: number): number {
  const evicted = history.push(dtSeconds);
  if (evicted !== undefined) sum -= evicted;
  sum += dtSeconds;
  return history.count / sum;
}
