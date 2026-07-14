import type { Vec3 } from "@solitude/plugin-api/math";
import {
  EPS_ECCENTRICITY,
  EPS_SPEED_FINE,
  EPS_TIME_SEC,
  vec3,
} from "@solitude/plugin-api/math";
import type {
  ExternalControlledBody,
  ExternalEntityId,
  ExternalWorld,
} from "@solitude/plugin-api/world";
import {
  computeStandardGravitationalParameter,
  getDominantBodyPrimary,
} from "@solitude/plugin-api/world";

export interface OrbitReadout {
  primaryId: ExternalEntityId;
  distance: number;
  speed: number;
  semiMajorAxis: number;
  eccentricity: number;
  inclinationRad: number;
  periapsis: number;
  apoapsis: number;
  isBound: boolean;
  radialSpeed: number;
  tangentialSpeed: number;
  circularSpeed: number;
  deltaVCircularRadial: number;
  deltaVCircularTangential: number;
  timeToPeriapsisSec: number | null;
  timeToApoapsisSec: number | null;
}

const rScratch: Vec3 = vec3.zero();
const vScratch: Vec3 = vec3.zero();
const hScratch: Vec3 = vec3.zero();
const rHatScratch: Vec3 = vec3.zero();
const tempScratch: Vec3 = vec3.zero();
const eVecScratch: Vec3 = vec3.zero();

export function createOrbitReadout(): OrbitReadout {
  return {
    primaryId: "",
    distance: 0,
    speed: 0,
    semiMajorAxis: 0,
    eccentricity: 0,
    inclinationRad: 0,
    periapsis: 0,
    apoapsis: 0,
    isBound: false,
    radialSpeed: 0,
    tangentialSpeed: 0,
    circularSpeed: 0,
    deltaVCircularRadial: 0,
    deltaVCircularTangential: 0,
    timeToPeriapsisSec: null,
    timeToApoapsisSec: null,
  };
}

export function computeOrbitReadoutInto(
  out: OrbitReadout,
  world: ExternalWorld,
  body: ExternalControlledBody,
): boolean {
  const primary = getDominantBodyPrimary(world, body.position);
  if (!primary) return false;

  vec3.subInto(rScratch, body.position, primary.body.position);
  vec3.subInto(vScratch, body.velocity, primary.body.velocity);

  const r = vec3.length(rScratch);
  if (r === 0) return false;

  const v2 = vec3.lengthSq(vScratch);
  const v = Math.sqrt(v2);
  const mu = computeStandardGravitationalParameter(primary.mass);
  if (mu === 0) return false;

  const rHat = vec3.scaleInto(rHatScratch, 1 / r, rScratch);
  const radialSpeed = vec3.dot(rHat, vScratch);
  const tangentialSpeed = Math.sqrt(
    Math.max(0, v2 - radialSpeed * radialSpeed),
  );
  const circularSpeed = Math.sqrt(mu / r);
  const deltaVCircularRadial = -radialSpeed;
  const deltaVCircularTangential = circularSpeed - tangentialSpeed;

  vec3.crossInto(hScratch, rScratch, vScratch);
  const h = vec3.length(hScratch);

  const energy = v2 * 0.5 - mu / r;
  const semiMajorAxis = energy === 0 ? Infinity : -mu / (2 * energy);

  vec3.crossInto(tempScratch, vScratch, hScratch);
  vec3.scaleInto(tempScratch, 1 / mu, tempScratch);
  vec3.subInto(eVecScratch, tempScratch, rHat);
  const eccentricity = vec3.length(eVecScratch);

  let inclinationRad = 0;
  if (h > 0) {
    const cosI = Math.min(1, Math.max(-1, hScratch.z / h));
    inclinationRad = Math.acos(cosI);
  }

  const isBound = eccentricity < 1 && energy < 0;
  const semiLatusRectum = h === 0 ? 0 : (h * h) / mu;
  const periapsis =
    semiLatusRectum >= 0 ? semiLatusRectum / (1 + eccentricity) : NaN;
  const apoapsis = isBound ? semiLatusRectum / (1 - eccentricity) : Infinity;

  out.primaryId = primary.id;
  out.distance = r;
  out.speed = v;
  out.semiMajorAxis = semiMajorAxis;
  out.eccentricity = eccentricity;
  out.inclinationRad = inclinationRad;
  out.periapsis = periapsis;
  out.apoapsis = apoapsis;
  out.isBound = isBound;
  out.radialSpeed = radialSpeed;
  out.tangentialSpeed = tangentialSpeed;
  out.circularSpeed = circularSpeed;
  out.deltaVCircularRadial = deltaVCircularRadial;
  out.deltaVCircularTangential = deltaVCircularTangential;

  computeApsisTimersInto(
    out,
    isBound,
    eccentricity,
    semiMajorAxis,
    semiLatusRectum,
    r,
    radialSpeed,
    mu,
  );

  return true;
}

function computeApsisTimersInto(
  out: OrbitReadout,
  isBound: boolean,
  eccentricity: number,
  semiMajorAxis: number,
  semiLatusRectum: number,
  r: number,
  radialSpeed: number,
  mu: number,
): void {
  if (eccentricity < EPS_ECCENTRICITY) {
    out.timeToPeriapsisSec = null;
    out.timeToApoapsisSec = null;
    return;
  }

  if (!isBound) {
    out.timeToPeriapsisSec = computeUnboundTimeToPeriapsis(
      eccentricity,
      semiMajorAxis,
      semiLatusRectum,
      r,
      radialSpeed,
      mu,
    );
    out.timeToApoapsisSec = null;
    return;
  }

  if (!Number.isFinite(semiMajorAxis)) {
    out.timeToPeriapsisSec = null;
    out.timeToApoapsisSec = null;
    return;
  }

  const meanMotion = Math.sqrt(
    mu / (semiMajorAxis * semiMajorAxis * semiMajorAxis),
  );
  if (meanMotion === 0) {
    out.timeToPeriapsisSec = null;
    out.timeToApoapsisSec = null;
    return;
  }

  const cosE = clamp((1 - r / semiMajorAxis) / eccentricity, -1, 1);
  const sinE = clamp(
    (radialSpeed * r) / (Math.sqrt(mu * semiMajorAxis) * eccentricity),
    -1,
    1,
  );

  let E = Math.atan2(sinE, cosE);
  if (E < 0) E += Math.PI * 2;

  let M = E - eccentricity * sinE;
  if (M < 0) M += Math.PI * 2;

  const twoPi = Math.PI * 2;
  let timeToPeriapsisSec = (twoPi - M) / meanMotion;
  if (timeToPeriapsisSec < EPS_TIME_SEC) timeToPeriapsisSec = 0;

  const timeToApoapsisSec =
    M <= Math.PI ? (Math.PI - M) / meanMotion : (3 * Math.PI - M) / meanMotion;

  out.timeToPeriapsisSec = timeToPeriapsisSec;
  out.timeToApoapsisSec = timeToApoapsisSec;
}

function computeUnboundTimeToPeriapsis(
  eccentricity: number,
  semiMajorAxis: number,
  semiLatusRectum: number,
  r: number,
  radialSpeed: number,
  mu: number,
): number | null {
  if (radialSpeed > EPS_SPEED_FINE) return null;

  if (Math.abs(eccentricity - 1) <= EPS_ECCENTRICITY) {
    return computeParabolicTimeToPeriapsis(
      eccentricity,
      semiLatusRectum,
      r,
      radialSpeed,
      mu,
    );
  }

  if (eccentricity <= 1 || semiMajorAxis >= 0) return null;

  return computeHyperbolicTimeToPeriapsis(
    eccentricity,
    -semiMajorAxis,
    r,
    radialSpeed,
    mu,
  );
}

function computeHyperbolicTimeToPeriapsis(
  eccentricity: number,
  semiMajorAxisMagnitude: number,
  r: number,
  radialSpeed: number,
  mu: number,
): number | null {
  if (semiMajorAxisMagnitude <= 0) return null;

  const coshH = Math.max(1, (r / semiMajorAxisMagnitude + 1) / eccentricity);
  const hMagnitude = Math.acosh(coshH);
  const h = radialSpeed < -EPS_SPEED_FINE ? -hMagnitude : hMagnitude;
  const meanAnomaly = eccentricity * Math.sinh(h) - h;
  const meanMotion = Math.sqrt(
    mu /
      (semiMajorAxisMagnitude *
        semiMajorAxisMagnitude *
        semiMajorAxisMagnitude),
  );
  if (meanMotion === 0) return null;

  return normalizeFuturePeriapsisTime(meanAnomaly / meanMotion);
}

function computeParabolicTimeToPeriapsis(
  eccentricity: number,
  semiLatusRectum: number,
  r: number,
  radialSpeed: number,
  mu: number,
): number | null {
  const periapsis = semiLatusRectum / (1 + eccentricity);
  if (periapsis <= 0) return null;

  const dMagnitude = Math.sqrt(Math.max(0, r / periapsis - 1));
  const d = radialSpeed < -EPS_SPEED_FINE ? -dMagnitude : dMagnitude;
  const timeSincePeriapsis =
    Math.sqrt((2 * periapsis * periapsis * periapsis) / mu) *
    (d + (d * d * d) / 3);

  return normalizeFuturePeriapsisTime(timeSincePeriapsis);
}

function normalizeFuturePeriapsisTime(
  timeSincePeriapsis: number,
): number | null {
  if (!Number.isFinite(timeSincePeriapsis)) return null;
  if (timeSincePeriapsis > EPS_TIME_SEC) return null;
  const timeToPeriapsis = -timeSincePeriapsis;
  return timeToPeriapsis < EPS_TIME_SEC ? 0 : timeToPeriapsis;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
