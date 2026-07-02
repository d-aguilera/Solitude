import { EPS_SPEED_SQ, type Vec3, vec3 } from "@solitude/engine/math";
import type { SegmentPlugin } from "@solitude/engine/plugin";
import type { ControlledBody } from "@solitude/engine/world";

const VELOCITY_SEGMENT_LENGTH = 500_000; // meters
const VELOCITY_SEGMENT_INNER_RADIUS = 7; // meters
const VELOCITY_SEGMENT_LINE_WIDTH = 4;
const VELOCITY_SEGMENT_FORWARD_COLOR = { r: 0, g: 255, b: 0 };
const VELOCITY_SEGMENT_BACKWARD_COLOR = { r: 255, g: 0, b: 0 };

export function createSegmentsPlugin(): SegmentPlugin {
  return {
    appendSegments: (into, { mainFocus }) => {
      if (!mutateFocusVelocitySegments(mainFocus.controlledBody)) {
        return;
      }
      into.addSegment(
        forwardStart,
        forwardEnd,
        VELOCITY_SEGMENT_FORWARD_COLOR,
        VELOCITY_SEGMENT_LINE_WIDTH,
      );
      into.addSegment(
        backwardStart,
        backwardEnd,
        VELOCITY_SEGMENT_BACKWARD_COLOR,
        VELOCITY_SEGMENT_LINE_WIDTH,
      );
    },
  };
}

/**
 * Pure helper that computes the world-space line segments representing
 * the focused body's velocity direction.
 */
function mutateFocusVelocitySegments(body: ControlledBody): boolean {
  vec3.copyInto(velocityScratch, body.velocity);

  const speedSq = vec3.lengthSq(velocityScratch);
  if (speedSq < EPS_SPEED_SQ) {
    return false;
  }

  const dir = vec3.normalizeInto(velocityScratch);
  const center = body.position;

  vec3.scaledAddInto(forwardStart, center, dir, VELOCITY_SEGMENT_INNER_RADIUS);
  vec3.scaledAddInto(forwardEnd, center, dir, VELOCITY_SEGMENT_LENGTH);
  vec3.scaledAddInto(
    backwardStart,
    center,
    dir,
    -VELOCITY_SEGMENT_INNER_RADIUS,
  );
  vec3.scaledAddInto(backwardEnd, center, dir, -VELOCITY_SEGMENT_LENGTH);

  return true;
}

// Shared scratch vectors for velocity debug segments.
const velocityScratch: Vec3 = vec3.zero();
const forwardStart: Vec3 = vec3.zero();
const forwardEnd: Vec3 = vec3.zero();
const backwardStart: Vec3 = vec3.zero();
const backwardEnd: Vec3 = vec3.zero();
