import { describe, expect, it } from "vitest";
import { createSolitudeLocalization } from "./localization";

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
});
