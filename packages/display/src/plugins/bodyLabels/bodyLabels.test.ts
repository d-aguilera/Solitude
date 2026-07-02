import { mat3, vec3 } from "@solitude/engine/math";
import type {
  SceneLabelCandidate,
  SceneLabelProviderParams,
} from "@solitude/engine/plugin";
import { createSceneLabelBuffer } from "@solitude/engine/plugin";
import type { Scene, SceneObject } from "@solitude/engine/render";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import type { World } from "@solitude/engine/world";
import { createEntityNameProvider } from "@solitude/entity-names";
import { describe, expect, it } from "vitest";
import { createBodyLabelsPlugin } from "./index";

function createOrbitalBody(id: string, parentId?: string): SceneObject {
  return {
    id,
    kind: "orbitalBody",
    centralEntityId: parentId,
    mesh: { points: [], faces: [] },
    meshLod: { kind: "none" },
    meshShading: { kind: "flat" },
    meshScale: 1,
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

function createControlledBody(id: string, displayName?: string): SceneObject {
  return {
    id,
    displayName,
    kind: "controlledBody",
    mesh: { points: [], faces: [] },
    meshLod: { kind: "none" },
    meshShading: { kind: "flat" },
    meshScale: 1,
    position: vec3.create(2000, 0, 0),
    orientation: mat3.identity,
    color: { r: 1, g: 1, b: 1 },
    lineWidth: 1,
    applyTransform: true,
    wireframeOnly: false,
    backFaceCulling: false,
  };
}

describe("body label plugin", () => {
  it("provides full scene label candidates for orbital bodies", () => {
    const plugin = createBodyLabelsPlugin();
    const labels = createSceneLabelBuffer();
    const scene: Scene = {
      lights: [],
      objects: [createOrbitalBody("planet:earth", "star:sun")],
    };

    plugin.labels?.appendLabels?.(labels, {
      ...createParams(scene),
      labelMode: "full",
    });

    const candidates = activeLabels(labels);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("planet:earth");
    expect(candidates[0].parentId).toBe("star:sun");
    expect(candidates[0].lines[0]).toBe("Earth");
    expect(candidates[0].lines[1]).toContain("d=");
    expect(candidates[0].lines[2]).toContain("v=");
  });

  it("provides name-only labels for compact views", () => {
    const plugin = createBodyLabelsPlugin();
    const labels = createSceneLabelBuffer();
    const scene: Scene = {
      lights: [],
      objects: [createOrbitalBody("planet:earth")],
    };

    plugin.labels?.appendLabels?.(labels, {
      ...createParams(scene),
      labelMode: "nameOnly",
      viewId: "top",
    });

    expect(activeLabels(labels)[0].lines).toEqual(["Earth"]);
  });

  it("localizes built-in solar-system names", () => {
    const plugin = createBodyLabelsPlugin({ locale: "es" });
    const labels = createSceneLabelBuffer();
    const scene: Scene = {
      lights: [],
      objects: [createOrbitalBody("planet:earth")],
    };

    plugin.labels?.appendLabels?.(labels, {
      ...createParams(
        scene,
        "ship:test",
        createPluginCapabilityRegistry([
          createEntityNameProvider({
            formatEntityName: (entityId) =>
              entityId === "planet:earth" ? "Tierra" : null,
          }),
        ]),
      ),
      labelMode: "nameOnly",
    });

    expect(activeLabels(labels)[0].lines).toEqual(["Tierra"]);
  });

  it("labels other controlled bodies by display name", () => {
    const plugin = createBodyLabelsPlugin();
    const labels = createSceneLabelBuffer();
    const scene: Scene = {
      lights: [],
      objects: [
        createControlledBody("ship:1", "Blue"),
        createControlledBody("ship:red", "Red"),
      ],
    };

    plugin.labels?.appendLabels?.(labels, createParams(scene, "ship:1"));

    const candidates = activeLabels(labels);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("ship:red");
    expect(candidates[0].lines[0]).toBe("Red");
    expect(candidates[0].lines[1]).toContain("d=");
    expect(candidates[0].lines[2]).toContain("v=");
  });
});

function activeLabels(labels: ReturnType<typeof createSceneLabelBuffer>) {
  return labels.items.slice(0, labels.count) as SceneLabelCandidate[];
}

function createParams(
  scene: Scene,
  focusEntityId = "ship:test",
  capabilityRegistry = createPluginCapabilityRegistry(),
): SceneLabelProviderParams {
  return {
    capabilityRegistry,
    config: {} as SceneLabelProviderParams["config"],
    labelMode: "full",
    mainFocus: {
      entityId: focusEntityId,
      controlledBody: {
        id: focusEntityId,
        position: vec3.zero(),
      },
    } as SceneLabelProviderParams["mainFocus"],
    scene,
    viewId: "primary",
    world: {
      controllableBodies: [
        {
          id: "ship:1",
          position: vec3.zero(),
          velocity: vec3.zero(),
        },
        {
          id: "ship:red",
          position: vec3.create(2000, 0, 0),
          velocity: vec3.create(0, 30, 0),
        },
      ],
    } as World,
  };
}
