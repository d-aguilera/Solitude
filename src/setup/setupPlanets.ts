import type {
  KeplerianOrbit,
  PlanetBodyConfig,
  StarBodyConfig,
} from "../app/configPorts";
import type { PlanetPhysics, RotatingBody, World } from "../domain/domainPorts";
import { mat3, type Mat3 } from "../domain/mat3";
import { vec3, type Vec3 } from "../domain/vec3";
import { parameters } from "../global/parameters";
import { mutateStateVectorFromKeplerian } from "./kepler";

// Scratch state for hierarchical initial state computation.
const initialStatePositionScratch: Record<string, Vec3> = {};
const initialStateVelocityScratch: Record<string, Vec3> = {};
const massByIdScratch: Record<string, number> = {};
const configByIdScratch: Record<string, PlanetBodyConfig | StarBodyConfig> = {};
const computingStateScratch: Record<string, boolean> = {};

/**
 * Add planets + stars from an arbitrary list of PlanetConfig.
 *
 * Responsibilities kept here:
 *  - Register corresponding CelestialBody entries in world
 *  - Register PlanetPhysics / StarPhysics entries for gravity
 *
 * Orbital initial conditions are derived from Keplerian elements relative
 * to a central body. After initialization, positions and velocities are
 * evolved using the gravity engine.
 */
export function addPlanetsAndStarsFromConfig(
  configs: (PlanetBodyConfig | StarBodyConfig)[],
  world: World,
): void {
  // Build lookup tables for configs and masses.
  buildConfigAndMassTables(configs);

  for (const cfg of configs) {
    // Compute initial heliocentric state for this body.
    const center = getInitialPositionForBody(cfg.id);
    const initialVelocity = getInitialVelocityForBody(cfg.id);

    // Derive the spin axis from the orbital frame and obliquity.
    let rotationAxis: Vec3;
    if (cfg.orbit.semiMajorAxis > 0) {
      const { normal, periapsisDir } = getOrbitFrameFromKepler(cfg.orbit);
      rotationAxis = rotateVectorAroundAxis(
        normal,
        periapsisDir,
        cfg.obliquityRad,
      );
    } else {
      // For bodies with no defined orbit (e.g. Sun at origin), interpret
      // obliquity relative to a global reference normal aligned with +Z.
      const normal = vec3.create(0, 0, 1);
      const periapsisDir = vec3.create(1, 0, 0);
      rotationAxis = rotateVectorAroundAxis(
        normal,
        periapsisDir,
        cfg.obliquityRad,
      );
    }

    const orientation = mat3.copy(mat3.identity, mat3.zero());

    const celestialBody: RotatingBody = {
      id: cfg.id,
      position: vec3.clone(center),
      velocity: vec3.clone(initialVelocity),
      orientation,
      rotationAxis,
      angularSpeedRadPerSec: cfg.angularSpeedRadPerSec,
    };

    const planetPhysics: PlanetPhysics = {
      id: cfg.id,
      physicalRadius: cfg.physicalRadius,
      density: cfg.density,
      mass: massByIdScratch[cfg.id],
    };

    if (cfg.kind === "star") {
      world.stars.push(celestialBody);
      world.starPhysics.push({
        ...planetPhysics,
        luminosity: cfg.luminosity,
      });
    } else if (cfg.kind === "planet") {
      world.planets.push(celestialBody);
      world.planetPhysics.push({ ...planetPhysics });
    }
  }
}

/**
 * Helper: compute physical mass from radius and density.
 */
function computePlanetMass(physicalRadius: number, density: number): number {
  const volume =
    (4 / 3) * Math.PI * physicalRadius * physicalRadius * physicalRadius;
  return density * volume;
}

/**
 * Initialize lookup tables for configs and derived masses.
 */
function buildConfigAndMassTables(
  configs: (PlanetBodyConfig | StarBodyConfig)[],
): void {
  // Reset scratch tables (keys are small; simple reassignment is fine).
  for (const key in configByIdScratch) {
    delete configByIdScratch[key];
  }
  for (const key in massByIdScratch) {
    delete massByIdScratch[key];
  }
  for (const key in initialStatePositionScratch) {
    delete initialStatePositionScratch[key];
  }
  for (const key in initialStateVelocityScratch) {
    delete initialStateVelocityScratch[key];
  }
  for (const key in computingStateScratch) {
    delete computingStateScratch[key];
  }

  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    configByIdScratch[cfg.id] = cfg;
    massByIdScratch[cfg.id] = computePlanetMass(
      cfg.physicalRadius,
      cfg.density,
    );
  }
}

/**
 * Compute (or retrieve) the initial heliocentric position for a body.
 */
function getInitialPositionForBody(id: string): Vec3 {
  let pos = initialStatePositionScratch[id];
  if (pos) return pos;

  computeInitialStateForBody(id);
  return initialStatePositionScratch[id];
}

/**
 * Compute (or retrieve) the initial heliocentric velocity for a body.
 */
function getInitialVelocityForBody(id: string): Vec3 {
  let vel = initialStateVelocityScratch[id];
  if (vel) return vel;

  computeInitialStateForBody(id);
  return initialStateVelocityScratch[id];
}

/**
 * Recursively compute the initial heliocentric state for a body based on
 * its orbit around a central body.
 *
 * For a root body (semiMajorAxis = 0), the state is the origin with
 * zero velocity.
 *
 * For regular bodies, the state is:
 *   state = parentState + relativeState
 *
 * where relativeState is derived from Keplerian elements relative to the
 * parent's mass.
 */
function computeInitialStateForBody(id: string): void {
  if (initialStatePositionScratch[id]) {
    return;
  }

  if (computingStateScratch[id]) {
    throw new Error(
      `Cyclic centralBodyId relationship detected while computing initial state for ${id}`,
    );
  }

  const cfg = configByIdScratch[id];
  if (!cfg) {
    throw new Error(`Config not found for body id=${id}`);
  }

  const isRoot = cfg.orbit.semiMajorAxis === 0 || cfg.centralBodyId === cfg.id;

  computingStateScratch[id] = true;

  let position: Vec3;
  let velocity: Vec3;

  if (isRoot) {
    position = vec3.zero();
    velocity = vec3.zero();
  } else {
    const parentId = cfg.centralBodyId;
    // Ensure parent state is computed first.
    computeInitialStateForBody(parentId);

    const parentPos = initialStatePositionScratch[parentId];
    const parentVel = initialStateVelocityScratch[parentId];

    const relState = {
      position: vec3.zero(),
      velocity: vec3.zero(),
    };

    const parentMass = massByIdScratch[parentId];
    mutateStateVectorFromKeplerian(
      relState,
      cfg.orbit,
      parentMass,
      parameters.newtonG,
    );

    // Compose heliocentric state
    position = vec3.addInto(vec3.zero(), parentPos, relState.position);
    velocity = vec3.addInto(vec3.zero(), parentVel, relState.velocity);
  }

  initialStatePositionScratch[id] = position;
  initialStateVelocityScratch[id] = velocity;
  computingStateScratch[id] = false;
}

// scratch
const R = mat3.zero();

/**
 * Compute the orbital plane normal and a reference direction within that plane
 * (pointing toward periapsis) from Keplerian elements.
 *
 * The returned vectors are unit-length and expressed in the world frame.
 */
function getOrbitFrameFromKepler(orbit: KeplerianOrbit): {
  normal: Vec3;
  periapsisDir: Vec3;
} {
  const {
    inclinationRad: i,
    lonAscNodeRad: Omega,
    argPeriapsisRad: omega,
  } = orbit;

  const cosO = Math.cos(Omega);
  const sinO = Math.sin(Omega);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);
  const cosw = Math.cos(omega);
  const sinw = Math.sin(omega);

  // We build the same 3-1-3 rotation used for positions/velocities:
  //   R = Rz(Ω) * Rx(i) * Rz(ω)
  //
  // The orbital normal is the image of +Z under Rz(Ω) * Rx(i).
  // The periapsis direction is the image of +X under the full R.
  //
  // First build the partial rotation Rz(Ω) * Rx(i).
  const RzO_RxI: Mat3 = [
    [cosO, -sinO * cosI, sinO * sinI],
    [sinO, cosO * cosI, -cosO * sinI],
    [0, sinI, cosI],
  ];

  // normal = (Rz(Ω) * Rx(i)) * [0, 0, 1] = third column of that matrix.
  const normal: Vec3 = vec3.create(RzO_RxI[0][2], RzO_RxI[1][2], RzO_RxI[2][2]);
  vec3.normalizeInto(normal);

  // Now build Rz(ω) for the in-plane periapsis direction.
  const RzW: Mat3 = [
    [cosw, -sinw, 0],
    [sinw, cosw, 0],
    [0, 0, 1],
  ];

  // Combined full rotation R = Rz(Ω) * Rx(i) * Rz(ω)
  mat3.mulMat3Into(R, RzO_RxI, RzW);

  // periapsisDir = R * [1, 0, 0] = first column of R.
  const periapsisDir: Vec3 = vec3.create(R[0][0], R[1][0], R[2][0]);
  vec3.normalizeInto(periapsisDir);

  return { normal, periapsisDir };
}

/**
 * Rotate a vector v around axis k by angle theta (Rodrigues' rotation formula).
 * Assumes k is a unit vector.
 */
function rotateVectorAroundAxis(
  v: Vec3,
  axisUnit: Vec3,
  angleRad: number,
): Vec3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);

  const kDotV = vec3.dot(axisUnit, v);

  const term1 = vec3.scaleInto(vec3.zero(), c, v);
  const term2 = vec3.scaleInto(
    vec3.zero(),
    s,
    vec3.crossInto(vec3.zero(), axisUnit, v),
  );
  const term3 = vec3.scaleInto(vec3.zero(), (1 - c) * kDotV, axisUnit);

  const out = vec3.zero();
  vec3.addInto(out, term1, term2);
  vec3.addInto(out, out, term3);
  return vec3.normalizeInto(out);
}
