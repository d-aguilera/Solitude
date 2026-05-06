import { describe, expect, it } from "vitest";
import type { PolylineSceneObject } from "../../app/scenePorts";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import { renderPolylinesInto } from "../renderPolylines";
import type { RenderedPolyline } from "../renderPorts";

function createPolyline(count: number, tail: number): PolylineSceneObject {
  return {
    id: "traj:craft:main",
    kind: "polyline",
    mesh: {
      points: [vec3.zero(), vec3.zero()],
      faces: [],
    },
    position: vec3.zero(),
    orientation: mat3.identity,
    color: { r: 255, g: 255, b: 255 },
    lineWidth: 1,
    wireframeOnly: true,
    applyTransform: false,
    backFaceCulling: false,
    count,
    tail,
  };
}

describe("renderPolylinesInto", () => {
  it("skips empty preallocated polylines", () => {
    const projected: RenderedPolyline[] = [];
    let projectCallCount = 0;

    const count = renderPolylinesInto(
      projected,
      [createPolyline(0, -1)],
      () => {
        projectCallCount++;
        return true;
      },
      () => true,
    );

    expect(count).toBe(0);
    expect(projectCallCount).toBe(0);
  });
});
