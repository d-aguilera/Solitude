import { describe, expect, it } from "vitest";
import { createPluginCapabilityRegistry } from "../../app/pluginCapabilities";
import type { GamePlugin } from "../../app/pluginPorts";

describe("plugin capabilities", () => {
  it("creates a capability registry from plugins", () => {
    const plugins: GamePlugin[] = [
      {
        capabilities: [{ id: "capability:a", value: "first" }],
        id: "a",
      },
      { id: "b" },
      {
        capabilities: [{ id: "capability:a", value: "second" }],
        id: "c",
      },
    ];

    const registry = createPluginCapabilityRegistry(plugins);

    expect(registry.getAll("capability:a")).toEqual(["first", "second"]);
  });

  it("creates a capability registry from raw providers", () => {
    const registry = createPluginCapabilityRegistry([
      { id: "capability:a", value: "first" },
      { id: "capability:a", value: "second" },
    ]);

    expect(registry.getAll("capability:a")).toEqual(["first", "second"]);
  });
});
