import { parameters } from "../global/parameters.js";
import type { BodyId, RotatingBody, ShipBody, World } from "./domainPorts.js";
import { EPS_ECCENTRICITY, EPS_TIME_SEC } from "./epsilon.js";
import { type Vec3, vec3 } from "./vec3.js";

export interface OrbitReadout {
  primaryId: BodyId;
  primaryRadius: number;
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

export type GravityPrimary = {
  id: BodyId;
  body: RotatingBody;
  mass: number;
  radius: number;
};

const rScratch: Vec3 = vec3.zero();
const vScratch: Vec3 = vec3.zero();
const hScratch: Vec3 = vec3.zero();
const rHatScratch: Vec3 = vec3.zero();
const tempScratch: Vec3 = vec3.zero();
const eVecScratch: Vec3 = vec3.zero();

export function computeShipOrbitReadout(
  world: World,
  ship: ShipBody,
): OrbitReadout | null {
  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) return null;

  vec3.subInto(rScratch, ship.position, primary.body.position);
  vec3.subInto(vScratch, ship.velocity, primary.body.velocity);

  const r = vec3.length(rScratch);
  if (r === 0) return null;

  const v2 = vec3.lengthSq(vScratch);
  const v = Math.sqrt(v2);
  const mu = parameters.newtonG * primary.mass;
  if (mu === 0) return null;

  const rHat = vec3.scaleInto(rHatScratch, 1 / r, rScratch);
  const radialSpeed = vec3.dot(rHat, vScratch);
  const tangentialSpeed = Math.sqrt(
    Math.max(0, v2 - radialSpeed * radialSpeed),
  );
  const circularSpeed = Math.sqrt(mu / r);
  const deltaVCircularRadial = -radialSpeed;
  const deltaVCircularTangential = circularSpeed - tangentialSpeed;

  // Specific angular momentum h = r x v
  vec3.crossInto(hScratch, rScratch, vScratch);
  const h = vec3.length(hScratch);

  // Specific orbital energy
  const energy = v2 * 0.5 - mu / r;
  const semiMajorAxis = energy === 0 ? Infinity : -mu / (2 * energy);

  // Eccentricity vector: e = (v x h)/mu - r_hat
  vec3.crossInto(tempScratch, vScratch, hScratch);
  vec3.scaleInto(tempScratch, 1 / mu, tempScratch);
  vec3.subInto(eVecScratch, tempScratch, rHat);
  const eccentricity = vec3.length(eVecScratch);

  // Inclination from angular momentum
  let inclinationRad = 0;
  if (h > 0) {
    const cosI = Math.min(1, Math.max(-1, hScratch.z / h));
    inclinationRad = Math.acos(cosI);
  }

  const isBound = eccentricity < 1 && energy < 0;
  const periapsis = isBound ? semiMajorAxis * (1 - eccentricity) : NaN;
  const apoapsis = isBound ? semiMajorAxis * (1 + eccentricity) : NaN;
  const { timeToPeriapsisSec, timeToApoapsisSec } = computeApsisTimers(
    isBound,
    eccentricity,
    semiMajorAxis,
    r,
    radialSpeed,
    mu,
  );

  return {
    primaryId: primary.id,
    primaryRadius: primary.radius,
    distance: r,
    speed: v,
    semiMajorAxis,
    eccentricity,
    inclinationRad,
    periapsis,
    apoapsis,
    isBound,
    radialSpeed,
    tangentialSpeed,
    circularSpeed,
    deltaVCircularRadial,
    deltaVCircularTangential,
    timeToPeriapsisSec,
    timeToApoapsisSec,
  };
}

export function getDominantBody(
  world: World,
  position: Vec3,
): RotatingBody | null {
  const primary = getDominantBodyPrimary(world, position);
  return primary ? primary.body : null;
}

export function getDominantBodyPrimary(
  world: World,
  position: Vec3,
): GravityPrimary | null {
  return findDominantBody(world, position);
}

function findDominantBody(world: World, position: Vec3): GravityPrimary | null {
  let best: GravityPrimary | null = null;
  let bestAccel = -Infinity;

  const planetCount = Math.min(
    world.planets.length,
    world.planetPhysics.length,
  );
  for (let i = 0; i < planetCount; i++) {
    const body = world.planets[i];
    const physics = world.planetPhysics[i];
    const accel = accelMagnitudeAtPosition(body, physics.mass, position);
    if (accel > bestAccel) {
      bestAccel = accel;
      best = {
        id: body.id,
        body,
        mass: physics.mass,
        radius: physics.physicalRadius,
      };
    }
  }

  const starCount = Math.min(world.stars.length, world.starPhysics.length);
  for (let i = 0; i < starCount; i++) {
    const body = world.stars[i];
    const physics = world.starPhysics[i];
    const accel = accelMagnitudeAtPosition(body, physics.mass, position);
    if (accel > bestAccel) {
      bestAccel = accel;
      best = {
        id: body.id,
        body,
        mass: physics.mass,
        radius: physics.physicalRadius,
      };
    }
  }

  return best;
}

function accelMagnitudeAtPosition(
  body: RotatingBody,
  mass: number,
  position: Vec3,
): number {
  const r2 = vec3.distSq(body.position, position);
  if (r2 === 0) return 0;
  return (parameters.newtonG * mass) / r2;
}

function computeApsisTimers(
  isBound: boolean,
  eccentricity: number,
  semiMajorAxis: number,
  r: number,
  radialSpeed: number,
  mu: number,
): { timeToPeriapsisSec: number | null; timeToApoapsisSec: number | null } {
  if (
    !isBound ||
    !Number.isFinite(semiMajorAxis) ||
    eccentricity < EPS_ECCENTRICITY
  ) {
    return { timeToPeriapsisSec: null, timeToApoapsisSec: null };
  }

  const meanMotion = Math.sqrt(
    mu / (semiMajorAxis * semiMajorAxis * semiMajorAxis),
  );
  if (meanMotion === 0) {
    return { timeToPeriapsisSec: null, timeToApoapsisSec: null };
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

  return { timeToPeriapsisSec, timeToApoapsisSec };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
