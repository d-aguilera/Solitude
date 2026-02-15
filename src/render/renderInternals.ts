import type { Vec3 } from "../domain/domainPorts";
import type { ScreenPoint } from "./renderPorts";

export type ProjectedSegment = {
  a: ScreenPoint;
  b: ScreenPoint;
  clipped: boolean;
};

export type SegmentProjector = (
  into: ProjectedSegment,
  a: Vec3,
  b: Vec3,
) => boolean;
