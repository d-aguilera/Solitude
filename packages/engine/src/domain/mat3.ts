import { mat3 as geometryMat3, type Mat3 } from "@solitude/geometry";
import { alloc } from "../global/allocProfiler";

function zero(): Mat3 {
  alloc.mat3();
  return geometryMat3.zero();
}

/**
 * Engine adapter over the portable geometry primitives that retains allocation
 * profiling for engine-owned matrices.
 */
export const mat3 = {
  ...geometryMat3,
  zero,
};

export type { Mat3 };
