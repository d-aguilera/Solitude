import {
  mat3,
  vec3,
  type ExternalPolylineSceneObject,
} from "@solitude/plugin-api";
import { describe, expect, it } from "vitest";
import { updateTrajectories } from "./logic";
import type { Trajectory } from "./types";

describe("updateTrajectories", () => {
  it("adds historical samples across repeated ship trajectory intervals", () => {
    const sceneObject = createPolyline();
    const trajectory: Trajectory = {
      intervalMillis: 100,
      remainingMillis: 0,
      sceneObject,
    };

    updateTrajectories(100, [trajectory]);
    vec3.copyInto(sceneObject.position, vec3.create(1, 0, 0));
    updateTrajectories(100, [trajectory]);
    vec3.copyInto(sceneObject.position, vec3.create(2, 0, 0));
    updateTrajectories(100, [trajectory]);

    expect(sceneObject.count).toBe(3);
    expect(sceneObject.tail).toBe(2);
    expect(sceneObject.mesh.points[0]).toEqual(vec3.create(0, 0, 0));
    expect(sceneObject.mesh.points[1]).toEqual(vec3.create(1, 0, 0));
    expect(sceneObject.mesh.points[2]).toEqual(vec3.create(2, 0, 0));
  });
});

function createPolyline(): ExternalPolylineSceneObject {
  return {
    applyTransform: false,
    backFaceCulling: false,
    color: { b: 0, g: 128, r: 255 },
    count: 0,
    id: "traj:ship:test",
    kind: "polyline",
    lineWidth: 2,
    mesh: {
      faces: [],
      points: [vec3.zero(), vec3.zero(), vec3.zero()],
    },
    meshLod: { kind: "none" },
    meshScale: 1,
    meshShading: { kind: "flat" },
    orientation: mat3.identity,
    position: vec3.zero(),
    tail: -1,
    wireframeOnly: true,
  };
}
