import { vec } from "./math.js";
import type { LocalFrame, Model, Vec3 } from "./types.js";

export function makeLocalFrame(up: Vec3): LocalFrame {
  const u = vec.normalize(up);

  const worldForward: Vec3 =
    Math.abs(u.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };

  const dot = vec.dot(u, worldForward);
  let forward = vec.sub(worldForward, vec.scale(u, dot));
  forward = vec.normalize(forward);

  let right = vec.cross(forward, u);
  right = vec.normalize(right);

  forward = vec.cross(u, right);

  return { right, forward, up: u };
}

export function generatePlanetMesh(
  center: Vec3,
  radius: number,
  subdivisions = 3
): Model {
  const t = (1 + Math.sqrt(5)) / 2;

  let vertices: Vec3[] = [
    { x: -1, y: t, z: 0 },
    { x: 1, y: t, z: 0 },
    { x: -1, y: -t, z: 0 },
    { x: 1, y: -t, z: 0 },

    { x: 0, y: -1, z: t },
    { x: 0, y: 1, z: t },
    { x: 0, y: -1, z: -t },
    { x: 0, y: 1, z: -t },

    { x: t, y: 0, z: -1 },
    { x: t, y: 0, z: 1 },
    { x: -t, y: 0, z: -1 },
    { x: -t, y: 0, z: 1 },
  ];

  vertices = vertices.map(vec.normalize);

  let faces: number[][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],

    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],

    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],

    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  for (let s = 0; s < subdivisions; s++) {
    const newFaces: number[][] = [];
    const midpointCache = new Map<string, number>();

    const getMidpointIndex = (i1: number, i2: number): number => {
      const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
      if (midpointCache.has(key)) return midpointCache.get(key)!;

      const v1 = vertices[i1];
      const v2 = vertices[i2];
      const mid = vec.normalize({
        x: (v1.x + v2.x) * 0.5,
        y: (v1.y + v2.y) * 0.5,
        z: (v1.z + v2.z) * 0.5,
      });

      const idx = vertices.length;
      vertices.push(mid);
      midpointCache.set(key, idx);
      return idx;
    };

    for (const [a, b, c] of faces) {
      const ab = getMidpointIndex(a, b);
      const bc = getMidpointIndex(b, c);
      const ca = getMidpointIndex(c, a);

      newFaces.push([a, ab, ca]);
      newFaces.push([b, bc, ab]);
      newFaces.push([c, ca, bc]);
      newFaces.push([ab, bc, ca]);
    }
    faces = newFaces;
  }

  const points: Vec3[] = vertices.map((v) => ({
    x: center.x + v.x * radius,
    y: center.y + v.y * radius,
    z: center.z + v.z * radius,
  }));

  // Ensure face normals point outward from this specific center
  for (let i = 0; i < faces.length; i++) {
    const [i0, i1, i2] = faces[i];
    const v0 = points[i0];
    const v1 = points[i1];
    const v2 = points[i2];

    const e1 = {
      x: v1.x - v0.x,
      y: v1.y - v0.y,
      z: v1.z - v0.z,
    };
    const e2 = {
      x: v2.x - v0.x,
      y: v2.y - v0.y,
      z: v2.z - v0.z,
    };
    const n = vec.cross(e1, e2);

    const toFace = {
      x: v0.x - center.x,
      y: v0.y - center.y,
      z: v0.z - center.z,
    };

    if (vec.dot(n, toFace) < 0) {
      faces[i] = [i0, i2, i1];
    }
  }

  return {
    objectType: "planet",
    points,
    faces,
    color: { r: 80, g: 160, b: 220 },
    lineWidth: 1,
  };
}
