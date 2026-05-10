import { describe, expect, it } from "vitest";
import type {
  ControlledBodySceneObject,
  DomainCameraPose,
  RGB,
  Scene,
} from "../../app/scenePorts";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import { ProjectionService } from "../ProjectionService";
import { createRenderFacesWorkspace, renderFacesInto } from "../renderFaces";
import {
  createRenderFrameCache,
  updateRenderFrameCache,
} from "../renderFrameCache";
import type { RenderedFace } from "../renderPorts";

describe("renderFacesInto", () => {
  it("sorts rendered faces by descending depth without the generic comparator", () => {
    const nearColor = { r: 100, g: 10, b: 10 };
    const farColor = { r: 10, g: 100, b: 10 };
    const scene: Scene = {
      lights: [],
      objects: [
        createSingleFaceObject("near", 10, nearColor),
        createSingleFaceObject("far", 20, farColor),
      ],
    };
    const camera = createCamera();
    const projectionService = new ProjectionService(camera, 1280, 720);
    const renderCache = createRenderFrameCache();
    updateRenderFrameCache(renderCache, scene);

    const faces: RenderedFace[] = [];
    const count = renderFacesInto(
      faces,
      scene,
      camera,
      1280,
      720,
      renderCache,
      projectionService,
      createRenderFacesWorkspace(),
      undefined,
      true,
    );

    expect(count).toBe(2);
    expect(faces[0].color).toEqual(shaded(farColor));
    expect(faces[1].color).toEqual(shaded(nearColor));
  });
});

function createCamera(): DomainCameraPose {
  return {
    frame: {
      forward: vec3.create(0, 1, 0),
      right: vec3.create(1, 0, 0),
      up: vec3.create(0, 0, 1),
    },
    position: vec3.zero(),
  };
}

function createSingleFaceObject(
  id: string,
  depth: number,
  color: RGB,
): ControlledBodySceneObject {
  return {
    applyTransform: true,
    backFaceCulling: false,
    color,
    id,
    kind: "controlledBody",
    lineWidth: 1,
    mesh: {
      faces: [[0, 1, 2]],
      points: [
        vec3.create(-1, depth, 0),
        vec3.create(1, depth, 0),
        vec3.create(0, depth, 1),
      ],
    },
    orientation: mat3.identity,
    position: vec3.zero(),
    wireframeOnly: false,
  };
}

function shaded(color: RGB): RGB {
  return {
    b: Math.round(color.b * 0.2),
    g: Math.round(color.g * 0.2),
    r: Math.round(color.r * 0.2),
  };
}
