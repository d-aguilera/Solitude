import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import { describe, expect, it } from "vitest";
import { createEntityNameProvider, formatEntityName } from "./entityNames";

describe("entity names", () => {
  it("uses providers and preserves explicit display names", () => {
    const capabilityRegistry = createPluginCapabilityRegistry([
      createEntityNameProvider({
        formatEntityName: (entityId) =>
          entityId === "ship:blue" ? "Azul" : null,
      }),
      createEntityNameProvider({
        formatEntityName: (entityId) =>
          entityId === "planet:earth" ? "Tierra" : null,
      }),
    ]);

    expect(
      formatEntityName(capabilityRegistry, "planet:earth", undefined),
    ).toBe("Tierra");
    expect(formatEntityName(capabilityRegistry, "ship:blue", undefined)).toBe(
      "Azul",
    );
    expect(
      formatEntityName(capabilityRegistry, "planet:custom", undefined),
    ).toBe("Custom");
    expect(
      formatEntityName(capabilityRegistry, "planet:earth", "Terra Prime"),
    ).toBe("Terra Prime");
  });
});
