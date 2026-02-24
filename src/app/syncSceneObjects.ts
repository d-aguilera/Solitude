import type { World } from "../domain/domainPorts.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import type { Scene, SceneObject } from "./appPorts.js";
import { getStarPhysicsById } from "./worldLookup.js";

/**
 * Internal helper: build the array of point lights from the current star bodies.
 */
export function buildLightsFromStars(world: World, scene: Scene): void {
  const lights = [];

  for (const starBody of world.stars) {
    const phys = getStarPhysicsById(world, starBody.id);

    lights.push({
      position: vec3.clone(starBody.position),
      intensity: phys.luminosity,
    });
  }

  scene.lights = lights;
}

const Rspin = mat3.zero();

/**
 * Per-frame adapter: advance axial rotation for planets and stars.
 */
export function rotateCelestialBodies(
  dtMillis: number,
  sceneObjects: SceneObject[],
): void {
  if (dtMillis === 0) return;
  alloc.withName("rotateCelestialBodies", () => {
    for (const obj of sceneObjects) {
      if (obj.kind !== "planet" && obj.kind !== "star") continue;

      const angle = (obj.angularSpeedRadPerSec * dtMillis) / 1000;
      if (angle === 0) continue;

      mat3.rotAxisInto(Rspin, obj.rotationAxis, angle);

      // Orientation is a local→world transform. Apply spin in local space
      // by left-multiplying the existing orientation.
      mat3.mulMat3Into(obj.orientation, Rspin, obj.orientation);
    }
  });
}
