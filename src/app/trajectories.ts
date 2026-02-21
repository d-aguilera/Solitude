import type { BodyId, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import type { Trajectory } from "./appInternals.js";
import type { Mesh, SceneObject } from "./appPorts.js";
import { RingBuffer } from "./RingBuffer.js";

/**
 * A trajectory state that handles the initial empty state.
 */
const empty = {
  update: (position: Vec3, { points, faces }: Mesh, { buffer }: Trajectory) => {
    // first point in mesh is always the object's position
    // and is updated every frame by the caller of this function.
    // We don't touch that first point here (points[0]).
    // We take a snapshot of current position, add it to the mesh
    // (points[1]), and put it in the buffer.
    // The buffer will always contain 1 point less than the mesh.
    points.length = 2;
    points[1] = vec3.clone(position);
    buffer.push(vec3.clone(position));

    // create one single "face" with the first segment (points[0] -> points[1])
    faces.length = 1;
    faces[0] = [0, 1];

    return growing;
  },
};

/**
 * A trajectory state that grows the buffer until it is full.
 */
const growing = {
  update: (position: Vec3, { points, faces }: Mesh, { buffer }: Trajectory) => {
    buffer.push(vec3.clone(position));
    const count = buffer.count + 1;

    // grow the mesh points array
    let i = 1;
    points.length = count;
    buffer.forEach((p) => {
      points[i++] = vec3.clone(p);
    });

    // grow the first/single face
    const face = faces[0];
    face.length = count;
    face[count - 1] = count - 1;

    // keep in growing state until the buffer is full
    return buffer.count < buffer.capacity ? growing : steady;
  },
};

/**
 * A trajectory state that handles the steady state where
 * the buffer is full. No conditionals.
 */
const steady = {
  update: (position: Vec3, { points }: Mesh, { buffer }: Trajectory) => {
    buffer.push(vec3.clone(position));

    let i = 1;
    buffer.forEach((p) => {
      vec3.copyInto(points[i++], p);
    });

    return steady;
  },
};

export function createTrajectory(capacity: number, intervalMillis: number) {
  return {
    buffer: new RingBuffer(capacity),
    intervalMillis,
    remainingMillis: 0,
    state: empty,
  } as Trajectory;
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

      const pathMesh: Mesh = objects[getIndex[pathId]].mesh;

      // the first point in the path is always the object's position
      pathMesh.points[0] = obj.position;

      // the rest of the points come from the trajectory
      const trajectory = trajectories[obj.id];
      if (trajectory.remainingMillis <= 0) {
        trajectory.state = trajectory.state.update(
          obj.position,
          pathMesh,
          trajectory,
        );
        trajectory.remainingMillis += trajectory.intervalMillis;
      }
      trajectory.remainingMillis -= dtMillis;
    }
  });
}
