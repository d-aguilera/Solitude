import type {
  CelestialBody,
  KeplerianOrbit,
  Mat3,
  Mesh,
  PlanetPhysics,
  StarPhysics,
  Vec3,
  World,
} from "../domain/domainPorts.js";
import { NEWTON_G } from "../domain/domainPorts.js";
import { mutateStateVectorFromKeplerian } from "../domain/kepler.js";
import { mat3 } from "../domain/mat3.js";
import { generatePlanetMesh } from "../domain/models.js";
import { vec3 } from "../domain/vec3.js";
import type { PlanetBodyConfig, StarBodyConfig } from "./appInternals.js";
import type {
  CelestialBodySceneObject,
  PlanetSceneObject,
  SceneObject,
  StarSceneObject,
} from "./appPorts.js";
import { createPolylineSceneObject } from "./worldSetup.js";

/**
 * Add planets + stars + their orbit paths from an arbitrary list of PlanetConfig.
 *
 * Responsibilities kept here:
 *  - Create visual PlanetSceneObject / StarSceneObject
 *  - Register corresponding CelestialBody entries in world
 *  - Register PlanetPhysics / StarPhysics entries for gravity
 *
 * Orbital initial conditions are derived from Keplerian elements relative
 * to a central mass. After initialization, positions and velocities are
 * evolved using the gravity engine.
 */
export function addPlanetsAndStarsFromConfig(
  configs: (PlanetBodyConfig | StarBodyConfig)[],
  objects: SceneObject[],
  worldPlanets: World["planets"],
  worldPlanetPhysics: PlanetPhysics[],
  worldStars: World["stars"],
  worldStarPhysics: StarPhysics[],
): void {
  const bodyMeshTemplate: Mesh = generatePlanetMesh(3);

  for (const cfg of configs) {
    const bodyMesh: Mesh = { ...bodyMeshTemplate };

    let center: Vec3;
    let initialVelocity: Vec3;

    if (cfg.orbit.semiMajorAxis > 0) {
      // Use two-body Keplerian elements to derive initial state.
      const state = {
        position: vec3.zero(),
        velocity: vec3.zero(),
      };
      mutateStateVectorFromKeplerian(
        state,
        cfg.orbit,
        cfg.centralMassKg,
        NEWTON_G,
      );
      center = state.position;
      initialVelocity = state.velocity;
    } else {
      // Central body (e.g. Sun) at origin by convention.
      center = vec3.zero();
      initialVelocity = vec3.zero();
    }

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

    const angularSpeedRadPerSec = cfg.angularSpeedRadPerSec;

    const sceneObj: CelestialBodySceneObject = {
      id: cfg.id,
      kind: cfg.kind,
      mesh: bodyMesh,
      position: center,
      orientation: mat3.copy(mat3.identity, mat3.zero()),
      scale: cfg.physicalRadius,
      color: cfg.color,
      lineWidth: 1,
      applyTransform: true,
      wireframeOnly: false,
      initialVelocity,
      physicalRadius: cfg.physicalRadius,
      backFaceCulling: true,
      velocity: vec3.clone(initialVelocity),
      rotationAxis,
      angularSpeedRadPerSec,
    };

    const celestialBody: CelestialBody = {
      id: cfg.id,
      position: vec3.clone(center),
      velocity: vec3.clone(initialVelocity),
    };

    const planetPhysics: PlanetPhysics = {
      id: cfg.id,
      physicalRadius: cfg.physicalRadius,
      density: cfg.density,
      mass: computePlanetMass(cfg.physicalRadius, cfg.density),
    };

    if (cfg.kind === "star") {
      worldStars.push(celestialBody);
      worldStarPhysics.push({
        ...planetPhysics,
        luminosity: cfg.luminosity,
      } as StarPhysics);
      objects.push({
        ...sceneObj,
        kind: cfg.kind,
        luminosity: cfg.luminosity,
      } as StarSceneObject);
    } else {
      worldPlanets.push(celestialBody);
      worldPlanetPhysics.push(planetPhysics);
      objects.push({
        ...sceneObj,
      } as PlanetSceneObject);
    }

    // All get a path polyline. The path geometry is updated over time by
    // sampling actual positions, so it reflects non-circular Keplerian-like
    // trajectories after initialization.
    objects.push(createPolylineSceneObject(cfg.pathId, cfg.color));
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
