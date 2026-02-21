import type { BodyId } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import type { Trajectory } from "./appInternals.js";
import type { Mesh, SceneObject } from "./appPorts.js";
import { RingBuffer } from "./RingBuffer.js";

export function createTrajectory(
  capacity: number,
  intervalMillis: number,
): Trajectory {
  return {
    intervalMillis: intervalMillis,
    remainingMillis: 0,
    buffer: new RingBuffer(capacity),
  };
}

function rebuildPathMesh(mesh: Mesh, { buffer }: Trajectory): void {
  alloc.withName(rebuildPathMesh.name, () => {
    const { points, faces } = mesh;
    const count = buffer.count;

    // update single face
    if (count < 2) {
      faces.length = 0;
    } else if (count < 3) {
      faces.length = 1;
      faces[0] = [0, 1];
    } else {
      const face = faces[0];
      if (face.length < count) {
        face.length = count;
        face[count - 1] = count - 1;
      }
    }

    // update points
    points.length = count;
    let i = 0;
    buffer.forEach((p) => {
      let dst = points[i];
      if (dst) {
        vec3.copyInto(dst, p);
      } else {
        points[i] = vec3.clone(p);
      }
      i++;
    });
  });
}

/**
 * Sample and update trajectory polylines for the ship and planets.
 */
export function updateTrajectories(
  dtMillis: number,
  objects: SceneObject[],
  planetPathMappings: Record<BodyId, BodyId>,
  trajectories: Record<BodyId, Trajectory>,
): void {
  alloc.withName(updateTrajectories.name, () => {
    // build a scene objects lookup index
    const getIndex: Record<BodyId, number> = {};
    for (let i = 0; i < objects.length; i++) {
      getIndex[objects[i].id] = i;
    }

    let pathId: BodyId;
    for (const obj of objects) {
      if (obj.kind === "planet" || obj.kind === "star") {
        pathId = planetPathMappings[obj.id];
      } else if (obj.kind === "ship") {
        pathId = "path:ship:main";
      } else {
        continue;
      }
      if (!pathId) continue;

      const pathIndex = getIndex[pathId];
      const pathMesh: Mesh = objects[pathIndex].mesh;
      const trajectory = trajectories[obj.id];

      trajectory.remainingMillis -= dtMillis;
      if (trajectory.remainingMillis <= 0) {
        trajectory.buffer.push(vec3.clone(obj.position));
        trajectory.remainingMillis += trajectory.intervalMillis;
        rebuildPathMesh(pathMesh, trajectory);
      }
    }
  });
}
