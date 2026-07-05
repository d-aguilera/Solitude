import { mat3, vec3 } from "@solitude/engine/math";
import type { Scene, SceneObject } from "@solitude/engine/render";
import { describe, expect, it } from "vitest";
import { createSolarSystemMaterialsPlugin } from "./index";
import {
  earthCloudTextureId,
  earthDayTextureId,
  moonDayTextureId,
} from "./textureIds";

describe("solar system materials plugin", () => {
  it("assigns browser-owned texture materials to Earth and the Moon", () => {
    const scene: Scene = {
      lights: [],
      objects: [
        createOrbitalBody("planet:earth"),
        createOrbitalBody("planet:moon"),
        createOrbitalBody("planet:mars"),
      ],
    };

    createSolarSystemMaterialsPlugin().scene?.initScene?.({
      config: {
        entities: [],
        mainFocusEntityId: "ship:test",
        render: {
          mainViewCameraOffset: vec3.zero(),
          mainViewLookState: { azimuth: 0, elevation: 0 },
        },
      },
      mainFocus: {
        controlledBody: {
          angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
          frame: {
            forward: vec3.create(0, 1, 0),
            right: vec3.create(1, 0, 0),
            up: vec3.create(0, 0, 1),
          },
          id: "ship:test",
          orientation: mat3.identity,
          position: vec3.zero(),
          velocity: vec3.zero(),
        },
        entityId: "ship:test",
      },
      scene,
      world: {
        axialSpins: [],
        collisionSpheres: [],
        controllableBodies: [],
        entities: [],
        entityIndex: new Map(),
        entityStates: [],
        gravityMasses: [],
        lightEmitters: [],
      },
    });

    expect(scene.objects[0].material).toEqual(
      expect.objectContaining({
        cloudTextureId: earthCloudTextureId,
        kind: "sphericalTexture",
        textureId: earthDayTextureId,
      }),
    );
    expect(scene.objects[1].material).toEqual({
      kind: "sphericalTexture",
      textureId: moonDayTextureId,
    });
    expect(scene.objects[2].material).toBeUndefined();
  });
});

function createOrbitalBody(id: string): SceneObject {
  return {
    applyTransform: true,
    backFaceCulling: true,
    color: { b: 255, g: 255, r: 255 },
    id,
    kind: "orbitalBody",
    lineWidth: 1,
    mesh: { faces: [], points: [] },
    meshLod: { kind: "none" },
    meshScale: 1,
    meshShading: { kind: "flat" },
    orientation: mat3.identity,
    position: vec3.zero(),
    velocity: vec3.zero(),
    wireframeOnly: false,
  };
}
