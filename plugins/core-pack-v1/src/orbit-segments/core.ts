import type { Vec3 } from "@solitude/plugin-api/math";
import { EPS_ECCENTRICITY, EPS_LEN, vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalControlledBody,
  ExternalSegmentPlugin,
  ExternalSegmentProviderParams,
  ExternalWorld,
  ExternalWorldSegmentSink,
} from "@solitude/plugin-api/plugin";
import {
  computeStandardGravitationalParameter,
  getDominantBodyPrimary,
} from "@solitude/plugin-api/world";

const ORBIT_SAMPLE_COUNT = 192;
const ORBIT_LINE_WIDTH = 2;
const ORBIT_COLOR = { r: 96, g: 208, b: 255 };

export interface OrbitSegmentsController {
  requestToggle: () => void;
  segments: ExternalSegmentPlugin;
}

export function createOrbitSegmentsController(): OrbitSegmentsController {
  const geometry = createOrbitSegmentGeometry(ORBIT_SAMPLE_COUNT);
  let active = false;
  let toggleRequested = false;

  return {
    requestToggle: () => {
      toggleRequested = true;
    },
    segments: {
      appendSegments: (into, params) => {
        if (toggleRequested) {
          active = !active;
          toggleRequested = false;
        }
        if (!active) return;
        if (!mutateFocusOrbitSegments(geometry, params)) return;
        for (let i = 0; i < geometry.points.length; i++) {
          appendOrbitSegment(into, geometry, i);
        }
      },
    },
  };
}

interface OrbitSegmentGeometry {
  cos: Float64Array;
  points: Vec3[];
  sin: Float64Array;
}

export function mutateFocusOrbitSegments(
  geometry: OrbitSegmentGeometry,
  { mainFocus, world }: ExternalSegmentProviderParams,
): boolean {
  return mutateOrbitSegmentsForBody(geometry, world, mainFocus.controlledBody);
}

function createOrbitSegmentGeometry(sampleCount: number): OrbitSegmentGeometry {
  const points = Array.from({ length: sampleCount }, () => vec3.zero());
  const cos = new Float64Array(sampleCount);
  const sin = new Float64Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * Math.PI * 2;
    cos[i] = Math.cos(angle);
    sin[i] = Math.sin(angle);
  }
  return { cos, points, sin };
}

function appendOrbitSegment(
  into: ExternalWorldSegmentSink,
  geometry: OrbitSegmentGeometry,
  index: number,
): void {
  into.addSegment(
    geometry.points[index],
    geometry.points[(index + 1) % geometry.points.length],
    ORBIT_COLOR,
    ORBIT_LINE_WIDTH,
  );
}

function mutateOrbitSegmentsForBody(
  geometry: OrbitSegmentGeometry,
  world: ExternalWorld,
  body: ExternalControlledBody,
): boolean {
  const primary = getDominantBodyPrimary(world, body.position);
  if (!primary) return false;

  vec3.subInto(rScratch, body.position, primary.body.position);
  vec3.subInto(vScratch, body.velocity, primary.body.velocity);

  const r = vec3.length(rScratch);
  if (r <= EPS_LEN) return false;

  const mu = computeStandardGravitationalParameter(primary.mass);
  if (!Number.isFinite(mu) || mu <= 0) return false;

  vec3.crossInto(hScratch, rScratch, vScratch);
  const h = vec3.length(hScratch);
  if (h <= EPS_LEN) return false;

  const v2 = vec3.lengthSq(vScratch);
  const energy = v2 * 0.5 - mu / r;
  const semiMajorAxis = energy < 0 ? -mu / (2 * energy) : Number.NaN;
  if (!Number.isFinite(semiMajorAxis) || semiMajorAxis <= 0) return false;

  vec3.scaleInto(rHatScratch, 1 / r, rScratch);
  vec3.crossInto(tempScratch, vScratch, hScratch);
  vec3.scaleInto(tempScratch, 1 / mu, tempScratch);
  vec3.subInto(eccentricityScratch, tempScratch, rHatScratch);
  const eccentricity = vec3.length(eccentricityScratch);
  if (!Number.isFinite(eccentricity) || eccentricity >= 1) return false;

  if (!mutateOrbitBasis(eccentricity, h, rScratch)) return false;

  const semiMinorAxis =
    semiMajorAxis * Math.sqrt(Math.max(0, 1 - eccentricity * eccentricity));
  vec3.scaledAddInto(
    centerScratch,
    primary.body.position,
    majorDirScratch,
    -semiMajorAxis * eccentricity,
  );

  for (let i = 0; i < geometry.points.length; i++) {
    const point = geometry.points[i];
    vec3.scaledAddInto(
      point,
      centerScratch,
      majorDirScratch,
      semiMajorAxis * geometry.cos[i],
    );
    vec3.scaledAddInto(
      sampleScratch,
      point,
      minorDirScratch,
      semiMinorAxis * geometry.sin[i],
    );
    vec3.copyInto(point, sampleScratch);
  }

  return true;
}

function mutateOrbitBasis(
  eccentricity: number,
  h: number,
  relativePosition: Vec3,
): boolean {
  vec3.scaleInto(normalScratch, 1 / h, hScratch);
  if (eccentricity >= EPS_ECCENTRICITY) {
    vec3.scaleInto(majorDirScratch, 1 / eccentricity, eccentricityScratch);
  } else {
    vec3.copyInto(majorDirScratch, relativePosition);
    vec3.scaledAddInto(
      projectedMajorScratch,
      majorDirScratch,
      normalScratch,
      -vec3.dot(majorDirScratch, normalScratch),
    );
    vec3.copyInto(majorDirScratch, projectedMajorScratch);
    if (vec3.length(majorDirScratch) <= EPS_LEN) return false;
    vec3.normalizeInto(majorDirScratch);
  }

  vec3.crossInto(minorDirScratch, normalScratch, majorDirScratch);
  if (vec3.length(minorDirScratch) <= EPS_LEN) return false;
  vec3.normalizeInto(minorDirScratch);
  return true;
}

const centerScratch: Vec3 = vec3.zero();
const eccentricityScratch: Vec3 = vec3.zero();
const hScratch: Vec3 = vec3.zero();
const majorDirScratch: Vec3 = vec3.zero();
const minorDirScratch: Vec3 = vec3.zero();
const normalScratch: Vec3 = vec3.zero();
const projectedMajorScratch: Vec3 = vec3.zero();
const rHatScratch: Vec3 = vec3.zero();
const rScratch: Vec3 = vec3.zero();
const sampleScratch: Vec3 = vec3.zero();
const tempScratch: Vec3 = vec3.zero();
const vScratch: Vec3 = vec3.zero();
