import type {
  World,
  PlanetPhysics,
  StarPhysics,
  Mesh,
  Vec3,
  CelestialBody,
} from "../domain/domainPorts.js";
import { NEWTON_G } from "../domain/domainPorts.js";
import { mat3 } from "../domain/mat3.js";
import { generatePlanetMesh } from "../domain/models.js";
import { vec3 } from "../domain/vec3.js";
import { stateVectorFromKeplerian } from "../domain/kepler.js";
import type { PlanetBodyConfig, StarBodyConfig } from "./appInternals.js";
import type {
  SceneObject,
  StarSceneObject,
  PlanetSceneObject,
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
      const state = stateVectorFromKeplerian(
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

    const rotationAxis = vec3.normalizeInto(vec3.clone(cfg.rotationAxis));
    const angularSpeedRadPerSec = cfg.angularSpeedRadPerSec;

    if (cfg.kind === "star") {
      const starObj: StarSceneObject = {
        id: cfg.id,
        kind: "star",
        mesh: bodyMesh,
        position: center,
        orientation: mat3.identity,
        scale: cfg.physicalRadius,
        color: cfg.color,
        lineWidth: 1,
        applyTransform: true,
        wireframeOnly: false,
        initialVelocity,
        physicalRadius: cfg.physicalRadius,
        backFaceCulling: true,
        velocity: { ...initialVelocity },
        luminosity: cfg.luminosity,
        rotationAxis,
        angularSpeedRadPerSec,
      };

      const starBody: CelestialBody = {
        id: cfg.id,
        position: { ...center },
        velocity: { ...initialVelocity },
      };

      const starPhys: StarPhysics = {
        id: cfg.id,
        physicalRadius: cfg.physicalRadius,
        density: cfg.density,
        mass: computePlanetMass(cfg.physicalRadius, cfg.density),
        luminosity: cfg.luminosity,
      };

      worldStars.push(starBody);
      worldStarPhysics.push(starPhys);
      objects.push(starObj);
    } else {
      const planetObj: PlanetSceneObject = {
        id: cfg.id,
        kind: "planet",
        mesh: bodyMesh,
        position: center,
        orientation: mat3.identity,
        scale: cfg.physicalRadius,
        color: cfg.color,
        lineWidth: 1,
        applyTransform: true,
        wireframeOnly: false,
        initialVelocity,
        physicalRadius: cfg.physicalRadius,
        backFaceCulling: true,
        velocity: { ...initialVelocity },
        rotationAxis,
        angularSpeedRadPerSec,
      };

      worldPlanets.push({
        id: cfg.id,
        position: { ...center },
        velocity: { ...initialVelocity },
      });

      worldPlanetPhysics.push({
        id: cfg.id,
        physicalRadius: cfg.physicalRadius,
        density: cfg.density,
        mass: computePlanetMass(cfg.physicalRadius, cfg.density),
      });

      objects.push(planetObj);
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
