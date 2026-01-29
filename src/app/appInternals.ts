import type { LocalFrame, RGB, Vec3 } from "../domain/domainPorts.js";

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
};

/**
 * Simple container for the controlled body's pose and velocity.
 */
export interface ControlledBodyState {
  frame: LocalFrame;
  velocity: Vec3;
}

export interface PlanetTrajectory {
  planetId: string;
  buffers: RingBuffer<Vec3>[];
}

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
