import type { ExternalPluginCapabilityRegistry } from "@solitude/plugin-api/capabilities";
import { formatEntityName } from "@solitude/plugin-api/entity-names";
import { vec3 } from "@solitude/plugin-api/math";
import { describe, expect, it } from "vitest";
import { createPlugin } from "../../ship-color-names/index";

describe("ship color names plugin", () => {
  it("indexes localized names for controllable entities", () => {
    const plugin = createPlugin({ locale: "es" });
    plugin.hooks?.scene?.initScene?.({
      config: {
        entities: [
          {
            components: { renderable: { color: { r: 64, g: 180, b: 255 } } },
            id: "ship:1",
          },
          {
            components: { renderable: { color: { r: 255, g: 80, b: 80 } } },
            id: "planet:not-a-ship",
          },
        ],
      },
      scene: { objects: [] },
      world: {
        collisionSpheres: [],
        controllableBodies: [
          {
            frame: {
              forward: vec3.create(0, 1, 0),
              right: vec3.create(1, 0, 0),
              up: vec3.create(0, 0, 1),
            },
            id: "ship:1",
            position: vec3.zero(),
            velocity: vec3.zero(),
          },
        ],
        entityStates: [],
        gravityMasses: [],
      },
    });
    const registry: ExternalPluginCapabilityRegistry = {
      getAll: (id) =>
        plugin.capabilities
          ?.filter((capability) => capability.id === id)
          .map((capability) => capability.value) ?? [],
    };

    expect(formatEntityName(registry, "ship:1", undefined)).toBe("Azul");
    expect(formatEntityName(registry, "planet:not-a-ship", undefined)).toBe(
      "Not-a-ship",
    );
  });
});
