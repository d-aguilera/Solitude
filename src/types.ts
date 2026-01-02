export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Model {
  points: Vec3[];
  lines: number[][];
  faces?: number[][];
  color: RGB | string;
  lineWidth: number;
  objectType?: string;
}

export interface LocalFrame {
  right: Vec3;
  forward: Vec3;
  up: Vec3;
}
