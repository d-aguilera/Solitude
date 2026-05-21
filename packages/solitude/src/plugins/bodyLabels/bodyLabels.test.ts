import { mat3, vec3 } from "@solitude/engine/math";
import type {
  SceneLabelCandidate,
  SceneLabelProviderParams,
} from "@solitude/engine/plugin";
import type { Scene, SceneObject } from "@solitude/engine/render";
import type { World } from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import { createBodyLabelsPlugin } from "./index";

function createOrbitalBody(id: string, parentId?: string): SceneObject {
  return {
    id,
    kind: "orbitalBody",
    centralEntityId: parentId,
    mesh: { points: [], faces: [] },
    position: vec3.create(1000, 0, 0),
    orientation: mat3.identity,
    color: { r: 1, g: 1, b: 1 },
    lineWidth: 1,
    applyTransform: true,
    wireframeOnly: false,
    backFaceCulling: true,
    velocity: vec3.create(0, 20, 0),
  };
}

describe("body label plugin", () => {
  it("provides full scene label candidates for orbital bodies", () => {
    const plugin = createBodyLabelsPlugin();
    const labels: SceneLabelCandidate[] = [];
    const scene: Scene = {
      lights: [],
      objects: [createOrbitalBody("planet:earth", "star:sun")],
    };

    plugin.labels?.appendLabels?.(labels, {
      ...createParams(scene),
      labelMode: "full",
    });

    expect(labels).toHaveLength(1);
    expect(labels[0].id).toBe("planet:earth");
    expect(labels[0].parentId).toBe("star:sun");
    expect(labels[0].lines[0]).toBe("Earth");
    expect(labels[0].lines[1]).toContain("d=");
    expect(labels[0].lines[2]).toContain("v=");
  });

  it("provides name-only labels for compact views", () => {
    const plugin = createBodyLabelsPlugin();
    const labels: SceneLabelCandidate[] = [];
    const scene: Scene = {
      lights: [],
      objects: [createOrbitalBody("planet:earth")],
    };

    plugin.labels?.appendLabels?.(labels, {
      ...createParams(scene),
      labelMode: "nameOnly",
      viewId: "top",
    });

    expect(labels[0].lines).toEqual(["Earth"]);
  });
});

function createParams(scene: Scene): SceneLabelProviderParams {
  return {
    config: {} as SceneLabelProviderParams["config"],
    labelMode: "full",
    mainFocus: {
      entityId: "ship:test",
      controlledBody: {
        id: "ship:test",
        position: vec3.zero(),
      },
    } as SceneLabelProviderParams["mainFocus"],
    scene,
    viewId: "primary",
    world: {} as World,
  };
}
