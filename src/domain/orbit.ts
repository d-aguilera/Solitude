import { parameters } from "../global/parameters";
import type { BodyId, EntityMotionState, ShipBody, World } from "./domainPorts";
import { EPS_ECCENTRICITY, EPS_TIME_SEC } from "./epsilon";
import { type Vec3, vec3 } from "./vec3";

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
  body: EntityMotionState;
  mass: number;
  radius: number;
};

const rScratch: Vec3 = vec3.zero();
const vScratch: Vec3 = vec3.zero();
const hScratch: Vec3 = vec3.zero();
const rHatScratch: Vec3 = vec3.zero();
const tempScratch: Vec3 = vec3.zero();
const eVecScratch: Vec3 = vec3.zero();

export function createOrbitReadout(): OrbitReadout {
  return {
    primaryId: "",
    primaryRadius: 0,
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

export function computeShipOrbitReadoutInto(
  out: OrbitReadout,
  world: World,
  ship: ShipBody,
): boolean {
  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) return false;

  vec3.subInto(rScratch, ship.position, primary.body.position);
  vec3.subInto(vScratch, ship.velocity, primary.body.velocity);

  const r = vec3.length(rScratch);
  if (r === 0) return false;

  const v2 = vec3.lengthSq(vScratch);
  const v = Math.sqrt(v2);
  const mu = parameters.newtonG * primary.mass;
  if (mu === 0) return false;

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

  out.primaryId = primary.id;
  out.primaryRadius = primary.radius;
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
    r,
    radialSpeed,
    mu,
  );

  return true;
}

export function getDominantBody(
  world: World,
  position: Vec3,
): EntityMotionState | null {
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

  for (let i = 0; i < world.collisionSpheres.length; i++) {
    const sphere = world.collisionSpheres[i];
    const mass = findGravityMass(world, sphere.id);
    if (mass == null) continue;

    const accel = accelMagnitudeAtPosition(sphere.state, mass, position);
    if (accel > bestAccel) {
      bestAccel = accel;
      best = {
        id: sphere.id,
        body: sphere.state,
        mass,
        radius: sphere.radius,
      };
    }
  }

  return best;
}

function accelMagnitudeAtPosition(
  body: EntityMotionState,
  mass: number,
  position: Vec3,
): number {
  const r2 = vec3.distSq(body.position, position);
  if (r2 === 0) return 0;
  return (parameters.newtonG * mass) / r2;
}

function findGravityMass(world: World, id: BodyId): number | null {
  for (let i = 0; i < world.gravityMasses.length; i++) {
    const mass = world.gravityMasses[i];
    if (mass.id === id) return mass.mass;
  }
  return null;
}

function computeApsisTimersInto(
  out: OrbitReadout,
  isBound: boolean,
  eccentricity: number,
  semiMajorAxis: number,
  r: number,
  radialSpeed: number,
  mu: number,
): void {
  if (
    !isBound ||
    !Number.isFinite(semiMajorAxis) ||
    eccentricity < EPS_ECCENTRICITY
  ) {
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
