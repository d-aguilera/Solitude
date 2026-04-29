import type { SegmentPlugin, WorldSegment } from "../../app/pluginPorts";
import type { ControlledBody } from "../../domain/domainPorts";
import { EPS_SPEED_SQ } from "../../domain/epsilon";
import { type Vec3, vec3 } from "../../domain/vec3";

const VELOCITY_SEGMENT_LENGTH = 500000; // meters
const VELOCITY_SEGMENT_INNER_RADIUS = 7; // meters
const VELOCITY_SEGMENT_LINE_WIDTH = 4;
const VELOCITY_SEGMENT_FORWARD_COLOR = "lime";
const VELOCITY_SEGMENT_BACKWARD_COLOR = "red";

export function createSegmentsPlugin(): SegmentPlugin {
  return {
    appendSegments: (into, { mainFocus }) => {
      if (
        !mutateFocusVelocitySegments(mainFocus.controlledBody, velocitySegments)
      ) {
        return;
      }
      into.push(forwardSegment, backwardSegment);
    },
  };
}

/**
 * Pure helper that computes the world-space line segments representing
 * the focused body's velocity direction.
 */
function mutateFocusVelocitySegments(
  body: ControlledBody,
  [forward, backward]: WorldSegment[],
): boolean {
  vec3.copyInto(velocityScratch, body.velocity);

  const speedSq = vec3.lengthSq(velocityScratch);
  if (speedSq < EPS_SPEED_SQ) {
    return false;
  }

  const dir = vec3.normalizeInto(velocityScratch);
  const center = body.position;

  vec3.scaledAddInto(forward.start, center, dir, VELOCITY_SEGMENT_INNER_RADIUS);
  vec3.scaledAddInto(forward.end, center, dir, VELOCITY_SEGMENT_LENGTH);
  vec3.scaledAddInto(
    backward.start,
    center,
    dir,
    -VELOCITY_SEGMENT_INNER_RADIUS,
  );
  vec3.scaledAddInto(backward.end, center, dir, -VELOCITY_SEGMENT_LENGTH);

  return true;
}

// Shared scratch vectors for velocity debug segments.
const velocityScratch: Vec3 = vec3.zero();

const forwardSegment: WorldSegment = {
  start: vec3.zero(),
  end: vec3.zero(),
  cssColor: VELOCITY_SEGMENT_FORWARD_COLOR,
  lineWidth: VELOCITY_SEGMENT_LINE_WIDTH,
};

const backwardSegment: WorldSegment = {
  start: vec3.zero(),
  end: vec3.zero(),
  cssColor: VELOCITY_SEGMENT_BACKWARD_COLOR,
  lineWidth: VELOCITY_SEGMENT_LINE_WIDTH,
};

const velocitySegments: WorldSegment[] = [forwardSegment, backwardSegment];
