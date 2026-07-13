import { describe, expect, it } from "vitest";
import {
  createEntityNameProvider,
  formatEntityName,
  type EntityNameCapabilityProvider,
  type EntityNameCapabilityRegistry,
} from "./entityNames";

describe("entity names", () => {
  it("uses providers and preserves explicit display names", () => {
    const capabilityRegistry = createCapabilityRegistry([
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

function createCapabilityRegistry(
  providers: readonly EntityNameCapabilityProvider[],
): EntityNameCapabilityRegistry {
  return {
    getAll: (id) =>
      providers
        .filter((provider) => provider.id === id)
        .map((provider) => provider.value),
  };
}
