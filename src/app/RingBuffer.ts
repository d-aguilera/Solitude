import type { Vec3 } from "../domain/domainPorts";

export interface RingBuffer<T> {
  /** Fixed capacity of the buffer. */
  readonly capacity: number;

  /** Number of elements currently in the buffer. */
  readonly count: number;

  /** Index of newest element. */
  readonly tail: number;

  /**
   * Append a new element as the newest entry.
   *
   * - If buffer is not full, this increases `count`.
   * - If buffer is full, this overwrites the oldest element.
   *
   * Returns the evicted element when overwriting, or `undefined` if nothing was evicted.
   */
  push(value: T): T | undefined;

  /**
   * Iterate from tail to head (newest → oldest).
   */
  forEach(fn: (value: T) => void): void;
}

export class Vec3RingBuffer implements RingBuffer<Vec3> {
  private storage = new Array<Vec3>();

  constructor(capacity: number) {
    this.cap = capacity;
  }

  private cap: number;
  get capacity(): number {
    return this.cap;
  }

  private cnt = 0;
  get count(): number {
    return this.cnt;
  }

  private t = -1;
  get tail(): number {
    return this.t;
  }

  push(value: Vec3): Vec3 | undefined {
    if (this.cnt < this.cap) {
      // Grow phase: contiguous [0..count-1]
      this.t++;
      this.storage.push(value);
      this.cnt++;
      return undefined;
    }

    // Full: overwrite and evict oldest (at head)
    this.t = (this.t + 1) % this.cap;
    const evicted = this.storage[this.t];
    this.storage[this.t] = value;
    return evicted;
  }

  forEach(fn: (value: Vec3) => void): void {
    for (let i = 0; i < this.cnt; i++) {
      const idx = (this.cap + this.t - i) % this.cap;
      fn(this.storage[idx]);
    }
  }
}
