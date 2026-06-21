import type { Scene } from "@solitude/engine/render";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import { formatEntityName } from "@solitude/entity-names";
import { describe, expect, it } from "vitest";
import { createClientLocalization } from "../localization";
import { createShipColorNamesPlugin } from "../shipColorNames";

describe("ship color names", () => {
  it("indexes localized names from controlled-body colors", () => {
    const plugin = createShipColorNamesPlugin(
      createClientLocalization("es").shipColorNames,
    );
    plugin.scene?.initScene?.({
      config: {} as never,
      mainFocus: {} as never,
      scene: {
        lights: [],
        objects: [
          {
            color: { r: 64, g: 180, b: 255 },
            id: "ship:1",
            kind: "controlledBody",
          },
          {
            color: { r: 255, g: 80, b: 80 },
            id: "planet:not-a-ship",
            kind: "orbitalBody",
          },
        ],
      } as unknown as Scene,
      world: {} as never,
    });
    const registry = createPluginCapabilityRegistry(plugin.capabilities);

    expect(formatEntityName(registry, "ship:1", undefined)).toBe("Azul");
    expect(formatEntityName(registry, "planet:not-a-ship", undefined)).toBe(
      "Not-a-ship",
    );
  });
});
