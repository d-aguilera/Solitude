import type { Vec3 } from "@solitude/plugin-api/math";
import { raySphereFirstHitDistance, vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalMarkerPlugin,
  ExternalSegmentPlugin,
  ExternalSegmentProviderParams,
  ExternalWorldMarker,
  ExternalWorldMarkerSink,
  ExternalWorldSegment,
  ExternalWorldSegmentSink,
} from "@solitude/plugin-api/scene";
import type {
  ExternalControlledBody,
  ExternalEntityCollisionSphere,
  ExternalEntityId,
  ExternalWorld,
} from "@solitude/plugin-api/world";

const ACQUISITION_CONE_RADIANS = (15 * Math.PI) / 180;
const NOSE_OFFSET_METERS = 7;
const SHORT_BEAM_LENGTH_METERS = 500_000;
const BEAM_LINE_WIDTH = 2;
const CONNECTOR_LINE_WIDTH = 1;
const DOT_RADIUS_PIXELS = 4;
const CROSS_RADIUS_PIXELS = 6;
const TARGET_RING_RADIUS_PIXELS = 10;
const MARKER_LINE_WIDTH = 2;
const LASER_COLOR = { r: 255, g: 32, b: 32 };

interface FocusTargetState {
  active: boolean;
  targetId: ExternalEntityId | null;
}

interface LaserGeometry {
  beamEnd: Vec3;
  connectorEnd: Vec3;
  connectorStart: Vec3;
  impactPoint: Vec3;
  targetCenter: Vec3;
  hasBeam: boolean;
  hasConnector: boolean;
  hasImpact: boolean;
  hasMiss: boolean;
  hasTargetRing: boolean;
}

export interface TargetingLaserController {
  requestToggle: () => void;
  segments: ExternalSegmentPlugin;
  markers: ExternalMarkerPlugin;
}

export function createTargetingLaserController(): TargetingLaserController {
  const targetByFocusId = new Map<ExternalEntityId, FocusTargetState>();
  let toggleRequested = false;

  return {
    requestToggle: () => {
      toggleRequested = true;
    },
    segments: {
      appendSegments: (into, params) => {
        updateLaserGeometry(targetByFocusId, params, toggleRequested);
        toggleRequested = false;
        appendLaserSegments(into);
      },
    },
    markers: {
      appendMarkers: (into) => appendLaserMarkers(into),
    },
  };
}

function updateLaserGeometry(
  targetByFocusId: Map<ExternalEntityId, FocusTargetState>,
  { mainFocus, world }: ExternalSegmentProviderParams,
  applyToggle: boolean,
): void {
  resetGeometry();
  const focusId = mainFocus.entityId;
  let state = targetByFocusId.get(focusId);
  if (!state) {
    state = { active: false, targetId: null };
    targetByFocusId.set(focusId, state);
  }
  if (applyToggle) {
    state.active = !state.active;
    state.targetId = null;
  }
  if (!state.active) return;

  const body = mainFocus.controlledBody;
  if (!state.targetId) state.targetId = acquireTargetId(world, body);
  const target = findCollisionSphere(world, state.targetId);
  if (!target) {
    state.targetId = null;
    createShortBeam(body);
    return;
  }
  computeLockedTargetGeometry(world, body, target);
}

function acquireTargetId(
  world: ExternalWorld,
  body: ExternalControlledBody,
): ExternalEntityId | null {
  let bestId: ExternalEntityId | null = null;
  let bestAngularGap = ACQUISITION_CONE_RADIANS;
  let bestHitDistance = Number.POSITIVE_INFINITY;
  let sphere: ExternalEntityCollisionSphere;

  for (let i = 0; i < world.collisionSpheres.length; i++) {
    sphere = world.collisionSpheres[i];
    if (sphere.id === body.id) continue;
    vec3.subInto(centerDeltaScratch, sphere.state.position, body.position);
    const distanceSq = vec3.lengthSq(centerDeltaScratch);
    if (distanceSq <= sphere.radius * sphere.radius) continue;
    const distance = Math.sqrt(distanceSq);
    const forwardDistance = vec3.dot(centerDeltaScratch, body.frame.forward);
    if (forwardDistance <= 0) continue;

    const centerAngle = Math.acos(clampUnit(forwardDistance / distance));
    const angularRadius = Math.asin(clampUnit(sphere.radius / distance));
    const angularGap = Math.max(0, centerAngle - angularRadius);
    if (angularGap > bestAngularGap) continue;

    const hitDistance =
      raySphereFirstHitDistance(
        body.position,
        body.frame.forward,
        sphere.state.position,
        sphere.radius,
      ) ?? Number.POSITIVE_INFINITY;
    if (
      angularGap < bestAngularGap ||
      (angularGap === bestAngularGap && hitDistance < bestHitDistance)
    ) {
      bestId = sphere.id;
      bestAngularGap = angularGap;
      bestHitDistance = hitDistance;
    }
  }
  return bestId;
}

function computeLockedTargetGeometry(
  world: ExternalWorld,
  body: ExternalControlledBody,
  target: ExternalEntityCollisionSphere,
): void {
  const origin = body.position;
  const direction = body.frame.forward;
  let nearestHit: ExternalEntityCollisionSphere | null = null;
  let nearestHitDistance = Number.POSITIVE_INFINITY;
  let sphere: ExternalEntityCollisionSphere;
  for (let i = 0; i < world.collisionSpheres.length; i++) {
    sphere = world.collisionSpheres[i];
    if (sphere.id === body.id) continue;
    const hitDistance = raySphereFirstHitDistance(
      origin,
      direction,
      sphere.state.position,
      sphere.radius,
    );
    if (hitDistance !== null && hitDistance < nearestHitDistance) {
      nearestHit = sphere;
      nearestHitDistance = hitDistance;
    }
  }

  vec3.scaledAddInto(beamSegment.start, origin, direction, NOSE_OFFSET_METERS);
  geometry.hasBeam = true;
  if (nearestHit) {
    vec3.scaledAddInto(
      geometry.impactPoint,
      origin,
      direction,
      nearestHitDistance,
    );
    vec3.copyInto(geometry.beamEnd, geometry.impactPoint);
    geometry.hasImpact = true;
    if (nearestHit.id !== target.id) {
      vec3.copyInto(geometry.targetCenter, target.state.position);
      geometry.hasTargetRing = true;
    }
    return;
  }

  vec3.subInto(centerDeltaScratch, target.state.position, origin);
  const targetPlaneDistance = vec3.dot(centerDeltaScratch, direction);
  const beamDistance = Math.max(NOSE_OFFSET_METERS, targetPlaneDistance);
  vec3.scaledAddInto(geometry.beamEnd, origin, direction, beamDistance);
  vec3.copyInto(geometry.connectorStart, geometry.beamEnd);
  vec3.subInto(
    surfaceDirectionScratch,
    geometry.beamEnd,
    target.state.position,
  );
  if (vec3.lengthSq(surfaceDirectionScratch) > 0) {
    vec3.normalizeInto(surfaceDirectionScratch);
    vec3.scaledAddInto(
      geometry.connectorEnd,
      target.state.position,
      surfaceDirectionScratch,
      target.radius,
    );
  } else {
    vec3.copyInto(geometry.connectorEnd, target.state.position);
  }
  geometry.hasConnector = true;
  geometry.hasMiss = true;
}

function createShortBeam(body: ExternalControlledBody): void {
  vec3.scaledAddInto(
    beamSegment.start,
    body.position,
    body.frame.forward,
    NOSE_OFFSET_METERS,
  );
  vec3.scaledAddInto(
    geometry.beamEnd,
    body.position,
    body.frame.forward,
    SHORT_BEAM_LENGTH_METERS,
  );
  geometry.hasBeam = true;
}

function appendLaserSegments(into: ExternalWorldSegmentSink): void {
  if (!geometry.hasBeam) return;
  vec3.copyInto(beamSegment.end, geometry.beamEnd);
  into.addSegment(
    beamSegment.start,
    beamSegment.end,
    LASER_COLOR,
    BEAM_LINE_WIDTH,
  );
  if (geometry.hasConnector) {
    vec3.copyInto(connectorSegment.start, geometry.connectorStart);
    vec3.copyInto(connectorSegment.end, geometry.connectorEnd);
    into.addSegment(
      connectorSegment.start,
      connectorSegment.end,
      LASER_COLOR,
      CONNECTOR_LINE_WIDTH,
    );
  }
}

function appendLaserMarkers(into: ExternalWorldMarkerSink): void {
  if (geometry.hasImpact) {
    vec3.copyInto(impactMarker.position, geometry.impactPoint);
    into.addMarker(
      impactMarker.position,
      LASER_COLOR,
      DOT_RADIUS_PIXELS,
      MARKER_LINE_WIDTH,
      "dot",
    );
  }
  if (geometry.hasMiss) {
    vec3.copyInto(missMarker.position, geometry.beamEnd);
    into.addMarker(
      missMarker.position,
      LASER_COLOR,
      CROSS_RADIUS_PIXELS,
      MARKER_LINE_WIDTH,
      "cross",
    );
  }
  if (geometry.hasTargetRing) {
    vec3.copyInto(targetMarker.position, geometry.targetCenter);
    into.addMarker(
      targetMarker.position,
      LASER_COLOR,
      TARGET_RING_RADIUS_PIXELS,
      MARKER_LINE_WIDTH,
      "ring",
    );
  }
}

function findCollisionSphere(
  world: ExternalWorld,
  id: ExternalEntityId | null,
): ExternalEntityCollisionSphere | null {
  if (!id) return null;
  for (let i = 0; i < world.collisionSpheres.length; i++) {
    const sphere = world.collisionSpheres[i];
    if (sphere.id === id) return sphere;
  }
  return null;
}

function resetGeometry(): void {
  geometry.hasBeam = false;
  geometry.hasConnector = false;
  geometry.hasImpact = false;
  geometry.hasMiss = false;
  geometry.hasTargetRing = false;
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

const centerDeltaScratch = vec3.zero();
const surfaceDirectionScratch = vec3.zero();
const geometry: LaserGeometry = {
  beamEnd: vec3.zero(),
  connectorEnd: vec3.zero(),
  connectorStart: vec3.zero(),
  impactPoint: vec3.zero(),
  targetCenter: vec3.zero(),
  hasBeam: false,
  hasConnector: false,
  hasImpact: false,
  hasMiss: false,
  hasTargetRing: false,
};
const beamSegment: ExternalWorldSegment = {
  start: vec3.zero(),
  end: vec3.zero(),
  color: LASER_COLOR,
  lineWidth: BEAM_LINE_WIDTH,
};
const connectorSegment: ExternalWorldSegment = {
  start: vec3.zero(),
  end: vec3.zero(),
  color: LASER_COLOR,
  lineWidth: CONNECTOR_LINE_WIDTH,
};
const impactMarker: ExternalWorldMarker = {
  position: vec3.zero(),
  color: LASER_COLOR,
  radius: DOT_RADIUS_PIXELS,
  lineWidth: MARKER_LINE_WIDTH,
  shape: "dot",
};
const missMarker: ExternalWorldMarker = {
  position: vec3.zero(),
  color: LASER_COLOR,
  radius: CROSS_RADIUS_PIXELS,
  lineWidth: MARKER_LINE_WIDTH,
  shape: "cross",
};
const targetMarker: ExternalWorldMarker = {
  position: vec3.zero(),
  color: LASER_COLOR,
  radius: TARGET_RING_RADIUS_PIXELS,
  lineWidth: MARKER_LINE_WIDTH,
  shape: "ring",
};
