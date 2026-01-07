import type { LocalFrame, Mesh, RGB, Vec3 } from "./types.js";
import { vec } from "./vec3.js";

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

export function generatePlanetMesh(subdivisions = 3): Mesh {
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

  // Normalize to unit sphere
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
    x: v.x,
    y: v.y,
    z: v.z,
  }));

  // Ensure face normals point outward from the origin (unit sphere)
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

    // For a unit sphere centered at origin, v0 points outward.
    if (vec.dot(n, v0) < 0) {
      faces[i] = [i0, i2, i1];
    }
  }

  return {
    points,
    faces,
    color: { r: 80, g: 160, b: 220 },
  };
}

// Generic polyline mesh (used for plane and planet trajectories)
export function makePolylineMesh(color: RGB): Mesh {
  return {
    points: [],
    faces: [],
    color,
  };
}

/**
 * Append a point to a polyline mesh, adding a segment from the
 * previous point to this one if distance >= minSegmentLength.
 */
export function appendPointToPolylineMesh(mesh: Mesh, point: Vec3): void {
  const newIndex = mesh.points.length;
  if (newIndex === 0) {
    mesh.points.push({ ...point });
    return;
  }
  mesh.points.push({ ...point });
  mesh.faces.push([newIndex - 1, newIndex]);
}
