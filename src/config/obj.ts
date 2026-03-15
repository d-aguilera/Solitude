import { vec3, type Vec3 } from "../domain/vec3.js";

export interface ObjMesh {
  points: Vec3[];
  faces: number[][];
}

/**
 * Parse a minimal subset of Wavefront OBJ:
 * - `v x y z` vertices (ignores optional `w`)
 * - `f a b c ...` faces (triangulated as a fan), supports `v/vt/vn` and `v//vn`
 *
 * Indices are returned 0-based for direct use with `Mesh.faces`.
 */
export function parseObjMesh(objText: string): ObjMesh {
  const points: Vec3[] = [];
  const faces: number[][] = [];

  const lines = objText.split(/\r?\n/);
  for (let lineNo = 1; lineNo <= lines.length; lineNo++) {
    const raw = lines[lineNo - 1];
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    if (line.startsWith("v ")) {
      const parts = line.split(/\s+/);
      if (parts.length < 4) {
        throw new Error(`OBJ parse error on line ${lineNo}: invalid vertex`);
      }
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        throw new Error(`OBJ parse error on line ${lineNo}: invalid vertex`);
      }
      points.push(vec3.create(x, y, z));
      continue;
    }

    if (line.startsWith("f ")) {
      const parts = line.split(/\s+/).slice(1);
      if (parts.length < 3) continue;

      const poly: number[] = new Array(parts.length);
      for (let i = 0; i < parts.length; i++) {
        const token = parts[i];
        const vStr = token.split("/", 1)[0];
        const idxRaw = Number.parseInt(vStr, 10);
        if (!Number.isFinite(idxRaw) || idxRaw === 0) {
          throw new Error(`OBJ parse error on line ${lineNo}: invalid face`);
        }
        const idx = idxRaw < 0 ? points.length + idxRaw : idxRaw - 1;
        if (idx < 0 || idx >= points.length) {
          throw new Error(`OBJ parse error on line ${lineNo}: face index out of bounds`);
        }
        poly[i] = idx;
      }

      // Triangulate polygon as a fan: (0, i, i+1)
      for (let i = 1; i + 1 < poly.length; i++) {
        faces.push([poly[0], poly[i], poly[i + 1]]);
      }
      continue;
    }
  }

  return { points, faces };
}

