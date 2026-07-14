import type {
  ExternalPluginCapabilityProvider,
  ExternalPluginCapabilityRegistry,
} from "@solitude/plugin-api/capabilities";
import { createEntityNameProvider } from "@solitude/plugin-api/entity-names";
import { vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalScene,
  ExternalSceneLabelCandidate,
  ExternalSceneLabelProviderParams,
  ExternalSceneLabelSink,
  ExternalSceneObject,
} from "@solitude/plugin-api/scene";
import type { ExternalControlledBody } from "@solitude/plugin-api/world";
import { describe, expect, it } from "vitest";
import { createPlugin } from "./index";

describe("body label plugin", () => {
  it("provides full scene label candidates for orbital bodies", () => {
    const labels = createSceneLabelSink();
    const scene: ExternalScene = {
      objects: [createOrbitalBody("planet:earth", "star:sun")],
    };

    createPlugin({}).labels?.appendLabels?.(labels, {
      ...createParams(scene),
      labelMode: "full",
    });

    expect(labels.items).toHaveLength(1);
    expect(labels.items[0].id).toBe("planet:earth");
    expect(labels.items[0].parentId).toBe("star:sun");
    expect(labels.items[0].lines[0]).toBe("Earth");
    expect(labels.items[0].lines[1]).toContain("d=");
    expect(labels.items[0].lines[2]).toContain("v=");
  });

  it("provides name-only labels for compact views", () => {
    const labels = createSceneLabelSink();
    const scene: ExternalScene = {
      objects: [createOrbitalBody("planet:earth")],
    };

    createPlugin({}).labels?.appendLabels?.(labels, {
      ...createParams(scene),
      labelMode: "nameOnly",
      viewId: "top",
    });

    expect(labels.items[0].lines).toEqual(["Earth"]);
  });

  it("uses localized names contributed through capabilities", () => {
    const labels = createSceneLabelSink();
    const scene: ExternalScene = {
      objects: [createOrbitalBody("planet:earth")],
    };
    const nameProvider = createEntityNameProvider({
      formatEntityName: (entityId) =>
        entityId === "planet:earth" ? "Tierra" : null,
    });

    createPlugin({ locale: "es" }).labels?.appendLabels?.(
      labels,
      createParams(
        scene,
        "ship:test",
        createCapabilityRegistry([nameProvider]),
      ),
    );

    expect(labels.items[0].lines).toEqual(["Tierra", "d=1 km", "v=72 km/h"]);
  });

  it("labels other controlled bodies by display name", () => {
    const labels = createSceneLabelSink();
    const scene: ExternalScene = {
      objects: [
        createControlledSceneObject("ship:1", "Blue"),
        createControlledSceneObject("ship:red", "Red"),
      ],
    };

    createPlugin({}).labels?.appendLabels?.(
      labels,
      createParams(scene, "ship:1"),
    );

    expect(labels.items).toHaveLength(1);
    expect(labels.items[0].id).toBe("ship:red");
    expect(labels.items[0].lines[0]).toBe("Red");
    expect(labels.items[0].lines[1]).toContain("d=");
    expect(labels.items[0].lines[2]).toContain("v=");
  });
});

function createOrbitalBody(
  id: string,
  centralEntityId?: string,
): ExternalSceneObject {
  return {
    centralEntityId,
    id,
    kind: "orbitalBody",
    position: vec3.create(1000, 0, 0),
    velocity: vec3.create(0, 20, 0),
  };
}

function createControlledSceneObject(
  id: string,
  displayName: string,
): ExternalSceneObject {
  return {
    displayName,
    id,
    kind: "controlledBody",
    position: vec3.create(2000, 0, 0),
  };
}

function createParams(
  scene: ExternalScene,
  focusEntityId = "ship:test",
  capabilityRegistry = createCapabilityRegistry(),
): ExternalSceneLabelProviderParams {
  const controlledBodies = [
    createControlledBody("ship:1", vec3.zero(), vec3.zero()),
    createControlledBody(
      "ship:red",
      vec3.create(2000, 0, 0),
      vec3.create(0, 30, 0),
    ),
  ];
  return {
    capabilityRegistry,
    config: { entities: [] },
    labelMode: "full",
    mainFocus: {
      controlledBody: createControlledBody(
        focusEntityId,
        vec3.zero(),
        vec3.zero(),
      ),
      entityId: focusEntityId,
    },
    scene,
    viewId: "primary",
    world: {
      collisionSpheres: [],
      controllableBodies: controlledBodies,
      entityStates: controlledBodies,
      gravityMasses: [],
    },
  };
}

function createControlledBody(
  id: string,
  position: ReturnType<typeof vec3.create>,
  velocity: ReturnType<typeof vec3.create>,
): ExternalControlledBody {
  return {
    frame: {
      forward: vec3.create(0, 1, 0),
      right: vec3.create(1, 0, 0),
      up: vec3.create(0, 0, 1),
    },
    id,
    position,
    velocity,
  };
}

function createCapabilityRegistry(
  providers: readonly ExternalPluginCapabilityProvider[] = [],
): ExternalPluginCapabilityRegistry {
  return {
    getAll: (id) =>
      providers
        .filter((provider) => provider.id === id)
        .map((provider) => provider.value),
  };
}

function createSceneLabelSink(): ExternalSceneLabelSink & {
  items: ExternalSceneLabelCandidate[];
} {
  const items: ExternalSceneLabelCandidate[] = [];
  return {
    get count() {
      return items.length;
    },
    items,
    addLabel: (id, anchor, lines, parentId, priority) => {
      const label = {
        anchor: vec3.clone(anchor),
        id,
        lines: [...lines],
        parentId,
        priority,
      };
      items.push(label);
      return label;
    },
    reset: () => items.splice(0, items.length),
  };
}
