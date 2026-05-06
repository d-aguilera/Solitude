import type { Vec3 } from "../domain/vec3";
import type { ScreenPoint } from "./scrn";

export type ProjectedSegment = {
  a: ScreenPoint;
  b: ScreenPoint;
  clipped: boolean;
};

/**
 * Projects the A-B segment into the screen space.
 * If the projected segment (Pa-Pb) is completely behind the camera (invisible),
 * it returns false.
 * If the projected segment is fully visible (both Pa and Pb in front of the camera),
 * it returns true and `into` contains Pa-Pb.
 * If the projected segment is partially visible (only one of Pa, Pb in front of the camera),
 * it returns true and `into` contains Pa-Pi or Pi-Pb, where Pi is the projected intersection
 * between A-B and the camera plane.
 */
export type SegmentProjector = (
  into: ProjectedSegment,
  a: Vec3,
  b: Vec3,
) => boolean;
