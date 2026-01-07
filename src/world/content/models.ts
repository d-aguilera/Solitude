import type { Mesh, Vec3 } from "../../world/types.js";
import { vec } from "../../world/vec3.js";

export const airplaneModel: Mesh = {
  points: [
    { x: 0, y: 0.5, z: 0 }, // 0: nose tip
    { x: 0, y: -0.1, z: 0.15 }, // 1: fuselage top center
    { x: -0.1, y: 0, z: 0 }, // 2: fuselage left center
    { x: 0.1, y: 0, z: 0 }, // 3: fuselage right center
    { x: 0, y: 0, z: -0.1 }, // 4: fuselage bottom center
    { x: 0, y: -0.5, z: 0 }, // 5: tail tip (unused)
    { x: -0.5, y: -0.3, z: 0 }, // 6: left wing tip
    { x: 0.5, y: -0.3, z: 0 }, // 7: right wing tip
    { x: 0, y: -0.5, z: 0.3 }, // 8: vertical stabilizer tip
    { x: -0.025, y: -0.5, z: 0.025 }, // 9: tail top left
    { x: 0.025, y: -0.5, z: 0.025 }, // 10: tail top right
    { x: -0.025, y: -0.5, z: -0.025 }, // 11: tail bottom left
    { x: 0.025, y: -0.5, z: -0.025 }, // 12: tail bottom right
  ],
  faces: [
    [1, 0, 2], // front fuselage, top left face
    [3, 0, 1], // front fuselage, top right face
    [2, 0, 4], // front fuselage, bottom left face
    [4, 0, 3], // front fuselage, bottom right face
    [2, 6, 9], // left wing top face
    [11, 6, 2], // left wing bottom face
    [9, 6, 11], // left wing, back face
    [10, 7, 3], // right wing top face
    [3, 7, 12], // right wing bottom face
    [12, 7, 10], // right wing back face
    [9, 8, 1], // vertical stabilizer left face
    [1, 8, 10], // vertical stabilizer right face
    [10, 8, 9], // vertical stabilizer back face
    [2, 9, 1], // back fuselage, top left face
    [1, 10, 3], // back fuselage, top right face
    [4, 11, 2], // back fuselage, bottom left face
    [3, 12, 4], // back fuselage, bottom right face
    [11, 4, 12], // back fuselage, bottom face
  ],
};

const t = (1 + Math.sqrt(5)) / 2;

export const icosahedronModel: Mesh = {
  points: [
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
  ].map(vec.normalize),
  faces: [
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
  ],
};

// --- Planet / sphere-like meshes ---

export function generatePlanetMesh(subdivisions = 3): Mesh {
  // Start from a deep clone of the base icosahedron mesh
  let vertices: Vec3[] = icosahedronModel.points.map((v) => ({
    x: v.x,
    y: v.y,
    z: v.z,
  }));

  let faces: number[][] = icosahedronModel.faces.map((f) => [...f] as number[]);

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
  };
}
