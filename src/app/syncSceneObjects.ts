import type { CelestialBody, ShipBody, World } from "../domain/domainPorts.js";
import { mat3FromLocalFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { alloc } from "../global/allocProfiler.js";
import type { PlanetSceneObject, Scene, StarSceneObject } from "./appPorts.js";
import { getStarPhysicsById } from "./worldLookup.js";

/**
 * Internal helper: build the array of point lights from the current star bodies.
 */
export function buildLightsFromStars(world: World, scene: Scene): void {
  const lights = [];

  for (const starBody of world.stars) {
    const phys = getStarPhysicsById(world, starBody.id);

    lights.push({
      position: { ...starBody.position },
      intensity: phys.luminosity,
    });
  }

  scene.lights = lights;
}

const Rspin = mat3.zero();

/**
 * Per-frame adapter: advance axial rotation for planets and stars.
 */
export function rotateCelestialBodies(scene: Scene, dtSeconds: number): void {
  if (dtSeconds === 0) return;
  alloc.withName("rotateCelestialBodies", () => {
    for (const obj of scene.objects) {
      if (obj.kind !== "planet" && obj.kind !== "star") continue;

      const angle = obj.angularSpeedRadPerSec * dtSeconds;
      if (angle === 0) continue;

      mat3.rotAxisInto(Rspin, obj.rotationAxis, angle);

      // Orientation is a local→world transform. Apply spin in local space
      // by left-multiplying the existing orientation.
      mat3.mulMat3Into(obj.orientation, Rspin, obj.orientation);
    }
  });
}

/**
 * Per‑frame adapter: keep Scene.lights in sync with the current star bodies.
 */
export function syncLightsToStars(world: World, scene: Scene): void {
  buildLightsFromStars(world, scene);
}

export function syncPlanetsToSceneObjects(
  planets: CelestialBody[],
  scene: Scene,
): void {
  for (const body of planets) {
    const obj = scene.objects.find(
      (o) => o.id === body.id,
    ) as PlanetSceneObject;
    if (!obj) continue;

    obj.position = body.position;
    obj.velocity = body.velocity;
  }
}

export function syncShipsToSceneObjects(
  shipBodies: ShipBody[],
  scene: Scene,
): void {
  for (const ship of shipBodies) {
    const obj = scene.objects.find((o) => o.id === ship.id);
    if (!obj) continue;

    // Keep renderer-facing pose in sync with physics ship.
    obj.position = ship.position;
    obj.orientation = mat3FromLocalFrame(ship.frame);
  }
}

export function syncStarsToSceneObjects(
  stars: CelestialBody[],
  scene: Scene,
): void {
  for (const starBody of stars) {
    const obj = scene.objects.find(
      (o) => o.id === starBody.id,
    ) as StarSceneObject;
    if (!obj) continue;

    obj.position = starBody.position;
    obj.velocity = starBody.velocity;
  }
}
