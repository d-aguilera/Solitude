import type {
  World,
  PlanetPhysics,
  StarPhysics,
  Mesh,
  Vec3,
  CelestialBody,
} from "../domain/domainPorts.js";
import { mat3 } from "../domain/mat3.js";
import { generatePlanetMesh } from "../domain/models.js";
import { trig } from "../domain/trig.js";
import { vec3 } from "../domain/vec3.js";
import type { PlanetBodyConfig, StarBodyConfig } from "./appInternals.js";
import type {
  SceneObject,
  StarSceneObject,
  PlanetSceneObject,
} from "./appPorts.js";
import {
  initialFrame,
  initialUp,
  createPolylineSceneObject,
} from "./worldSetup.js";

/**
 * Add planets + stars + their orbit paths from an arbitrary list of PlanetConfig.
 *
 * Responsibilities kept here:
 *  - Create visual PlanetSceneObject / StarSceneObject
 *  - Register corresponding CelestialBody entries in world
 *  - Register PlanetPhysics / StarPhysics entries for gravity
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

  // Define an orbital ship via two basis vectors:
  const radialAxis1: Vec3 = vec3.normalizeInto(
    vec3.clone(initialFrame.forward),
  );
  const radialAxis2: Vec3 = vec3.normalizeInto(vec3.clone(initialUp));

  for (const cfg of configs) {
    const theta = cfg.orbit.angleRad;
    const radial = trig.radialDirAtAngle(theta, radialAxis1, radialAxis2);
    const tangential = trig.tangentialDirAtAngle(
      theta,
      radialAxis1,
      radialAxis2,
    );

    // Physical orbit radius in meters
    const center: Vec3 = vec3.scaleInto(vec3.zero(), cfg.orbit.radius, radial);

    const bodyMesh: Mesh = { ...bodyMeshTemplate };

    const initialVelocity =
      cfg.orbit.radius > 0
        ? vec3.scaleInto(vec3.zero(), cfg.tangentialSpeed, tangential)
        : vec3.zero();

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

    // All get a path polyline
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
