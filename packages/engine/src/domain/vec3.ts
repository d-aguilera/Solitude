import { vec3 as geometryVec3, type Vec3 } from "@solitude/geometry";
import { alloc } from "../global/allocProfiler";

function clone(v: Readonly<Vec3>): Vec3 {
  alloc.vec3();
  return geometryVec3.clone(v);
}

function create(x: number, y: number, z: number): Vec3 {
  alloc.vec3();
  return geometryVec3.create(x, y, z);
}

function zero(): Vec3 {
  alloc.vec3();
  return geometryVec3.zero();
}

/**
 * Engine adapter over the portable geometry primitives that retains allocation
 * profiling for engine-owned vectors.
 */
export const vec3 = {
  ...geometryVec3,
  clone,
  create,
  zero,
};

export type { Vec3 };
