import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import { describe, expect, it } from "vitest";
import {
  createEntityNameProvider,
  createSolitudeLocalization,
  formatEntityName,
} from "./localization";

describe("Solitude localization", () => {
  it("omits thousands separators from Spanish numeric formatters", () => {
    const localization = createSolitudeLocalization("es");

    expect(localization.formatDistance(412_580_000)).toBe("412580 km");
    expect(localization.formatSpeed(29_579.72)).toBe("106487 km/h");
    expect(localization.formatDeltaV(1234.56)).toBe("1,23 km/s");
    expect(localization.formatFixed(0, 3)).toBe("0,000");
  });

  it("formats message templates", () => {
    const localization = createSolitudeLocalization("es");

    expect(
      localization.formatMessage("{gameId} | tick {tick}", {
        gameId: "game:1",
        tick: localization.formatFixed(123_456, 0),
      }),
    ).toBe("game:1 | tick 123456");
  });

  it("uses entity name providers and preserves explicit display names", () => {
    const capabilityRegistry = createPluginCapabilityRegistry([
      createEntityNameProvider({
        formatEntityName: (entityId, explicitDisplayName) => {
          if (explicitDisplayName) return explicitDisplayName;
          return entityId === "planet:earth" ? "Tierra" : null;
        },
      }),
    ]);

    expect(
      formatEntityName(capabilityRegistry, "planet:earth", undefined),
    ).toBe("Tierra");
    expect(
      formatEntityName(capabilityRegistry, "planet:custom", undefined),
    ).toBe("Custom");
    expect(
      formatEntityName(capabilityRegistry, "planet:earth", "Terra Prime"),
    ).toBe("Terra Prime");
  });
});
