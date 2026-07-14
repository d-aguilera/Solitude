import type { Vec3 } from "@solitude/plugin-api/math";
import { EPS_SPEED_SQ, vec3 } from "@solitude/plugin-api/math";
import type { ExternalSegmentPlugin } from "@solitude/plugin-api/scene";
import type { ExternalControlledBody } from "@solitude/plugin-api/world";

const VELOCITY_SEGMENT_LENGTH = 500_000;
const VELOCITY_SEGMENT_INNER_RADIUS = 7;
const VELOCITY_SEGMENT_LINE_WIDTH = 4;
const VELOCITY_SEGMENT_FORWARD_COLOR = { r: 0, g: 255, b: 0 };
const VELOCITY_SEGMENT_BACKWARD_COLOR = { r: 255, g: 0, b: 0 };

export function createSegmentsPlugin(): ExternalSegmentPlugin {
  return {
    appendSegments: (into, { mainFocus }) => {
      if (!mutateFocusVelocitySegments(mainFocus.controlledBody)) return;
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

function mutateFocusVelocitySegments(body: ExternalControlledBody): boolean {
  vec3.copyInto(velocityScratch, body.velocity);
  if (vec3.lengthSq(velocityScratch) < EPS_SPEED_SQ) return false;

  const direction = vec3.normalizeInto(velocityScratch);
  const center = body.position;
  vec3.scaledAddInto(
    forwardStart,
    center,
    direction,
    VELOCITY_SEGMENT_INNER_RADIUS,
  );
  vec3.scaledAddInto(forwardEnd, center, direction, VELOCITY_SEGMENT_LENGTH);
  vec3.scaledAddInto(
    backwardStart,
    center,
    direction,
    -VELOCITY_SEGMENT_INNER_RADIUS,
  );
  vec3.scaledAddInto(backwardEnd, center, direction, -VELOCITY_SEGMENT_LENGTH);
  return true;
}

const velocityScratch: Vec3 = vec3.zero();
const forwardStart: Vec3 = vec3.zero();
const forwardEnd: Vec3 = vec3.zero();
const backwardStart: Vec3 = vec3.zero();
const backwardEnd: Vec3 = vec3.zero();
