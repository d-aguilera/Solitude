import { vec3, type Vec3 } from "./vec3";

const aScratch: Vec3 = vec3.zero();
const bScratch: Vec3 = vec3.zero();
const cScratch: Vec3 = vec3.zero();
const crossScratch: Vec3 = vec3.zero();

/**
 * Compute the signed volume of a closed triangle mesh.
 *
 * Notes:
 * - The mesh should represent a closed, consistently-oriented surface for the
 *   result to be meaningful.
 */
function computeSignedVolumeOfTriangleMesh(
  points: ReadonlyArray<Readonly<Vec3>>,
  faces: ReadonlyArray<ReadonlyArray<number>>,
): number {
  if (points.length === 0 || faces.length === 0) return 0;

  // Translation-invariant formulation: sum tetrahedra relative to a reference point.
  const ref = points[0];

  let sum = 0;
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    if (f.length !== 3) {
      console.warn(`Skipping non-triangle face with ${f.length} vertices.`);
      continue;
    }

    const i0 = f[0] | 0;
    const i1 = f[1] | 0;
    const i2 = f[2] | 0;

    const p0 = points[i0];
    const p1 = points[i1];
    const p2 = points[i2];
    if (!p0 || !p1 || !p2) continue;

    vec3.subInto(aScratch, p0, ref);
    vec3.subInto(bScratch, p1, ref);
    vec3.subInto(cScratch, p2, ref);

    // 6 * V = dot(a, cross(b, c))
    vec3.crossInto(crossScratch, bScratch, cScratch);
    sum += vec3.dot(aScratch, crossScratch);
  }

  return sum / 6;
}

export function computeVolumeOfTriangleMesh(
  points: ReadonlyArray<Readonly<Vec3>>,
  faces: ReadonlyArray<ReadonlyArray<number>>,
): number {
  return Math.abs(computeSignedVolumeOfTriangleMesh(points, faces));
}
