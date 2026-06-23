import type { Mesh } from "../app/scenePorts";
import { vec3, type Vec3 } from "../domain/vec3";

const goldenRatio = (1 + Math.sqrt(5)) / 2;

const baseVertices = [
  [-1, goldenRatio, 0],
  [1, goldenRatio, 0],
  [-1, -goldenRatio, 0],
  [1, -goldenRatio, 0],
  [0, -1, goldenRatio],
  [0, 1, goldenRatio],
  [0, -1, -goldenRatio],
  [0, 1, -goldenRatio],
  [goldenRatio, 0, -1],
  [goldenRatio, 0, 1],
  [-goldenRatio, 0, -1],
  [-goldenRatio, 0, 1],
] as const;

const baseFaces: number[][] = [
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

export function createUnitIcosphereMesh(subdivisions: number): Mesh {
  if (!Number.isInteger(subdivisions) || subdivisions < 0) {
    throw new Error(`Icosphere subdivisions must be a non-negative integer`);
  }

  console.log("createUnitIcosphereMesh");

  const vertices: Vec3[] = baseVertices.map(([x, y, z]) =>
    vec3.normalizeInto(vec3.create(x, y, z)),
  );
  let faces = baseFaces.map((face) => [...face]);
  let midpointCache = new Map<string, number>();
  const midpointScratch = vec3.zero();

  const getMidpointIndex = (i1: number, i2: number): number => {
    const cacheKey = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
    const cached = midpointCache.get(cacheKey);
    if (cached !== undefined) return cached;

    vec3.addInto(midpointScratch, vertices[i1], vertices[i2]);
    const midpoint = vec3.clone(vec3.normalizeInto(midpointScratch));
    const index = vertices.push(midpoint) - 1;
    midpointCache.set(cacheKey, index);
    return index;
  };

  for (let subdivision = 0; subdivision < subdivisions; subdivision++) {
    const newFaces: number[][] = [];
    for (const [a, b, c] of faces) {
      const ab = getMidpointIndex(a, b);
      const bc = getMidpointIndex(b, c);
      const ca = getMidpointIndex(c, a);
      newFaces.push([a, ab, ca]);
      newFaces.push([b, bc, ab]);
      newFaces.push([c, ca, bc]);
      newFaces.push([ab, bc, ca]);
    }
    midpointCache = new Map<string, number>();
    faces = newFaces;
  }

  const faceNormals = createOutwardFaceNormals(vertices, faces);
  return { faceNormals, faces, points: vertices };
}

function createOutwardFaceNormals(points: Vec3[], faces: number[][]): Vec3[] {
  const faceNormals: Vec3[] = new Array(faces.length);
  const edge1 = vec3.zero();
  const edge2 = vec3.zero();
  const normal = vec3.zero();

  for (let index = 0; index < faces.length; index++) {
    const face = faces[index];
    writeFaceNormalInto(normal, points, face, edge1, edge2);
    if (vec3.dot(normal, points[face[0]]) < 0) {
      const next = face[1];
      face[1] = face[2];
      face[2] = next;
      writeFaceNormalInto(normal, points, face, edge1, edge2);
    }
    faceNormals[index] = vec3.clone(vec3.normalizeInto(normal));
  }

  return faceNormals;
}

function writeFaceNormalInto(
  into: Vec3,
  points: Vec3[],
  face: number[],
  edge1: Vec3,
  edge2: Vec3,
): void {
  const p0 = points[face[0]];
  const p1 = points[face[1]];
  const p2 = points[face[2]];
  vec3.subInto(edge1, p1, p0);
  vec3.subInto(edge2, p2, p0);
  vec3.crossInto(into, edge1, edge2);
}
