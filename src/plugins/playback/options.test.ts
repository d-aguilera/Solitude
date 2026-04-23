import { describe, expect, it } from "vitest";
import { parsePlaybackRuntimeOptions } from "./options";

describe("playback runtime options", () => {
  it("ignores unrelated runtime options", () => {
    expect(parsePlaybackRuntimeOptions({ autopilot: "v1" })).toEqual({
      diagnosticLogWarning: null,
      diagnosticWarning: null,
    });
  });

  it("parses capture and playback diagnostics", () => {
    expect(
      parsePlaybackRuntimeOptions({
        mode: "capture",
        scenario: "moon-circle",
      }),
    ).toEqual({
      diagnostic: { mode: "capture", scenario: "moon-circle" },
      diagnosticLogWarning: null,
      diagnosticWarning: null,
    });

    expect(
      parsePlaybackRuntimeOptions({
        log: "circle-now",
        mode: "playback",
        scenario: "moon-circle-long",
      }),
    ).toEqual({
      diagnostic: {
        log: "circle-now",
        mode: "playback",
        scenario: "moon-circle-long",
      },
      diagnosticLogWarning: null,
      diagnosticWarning: null,
    });
  });

  it("fails closed for invalid diagnostics", () => {
    expect(
      parsePlaybackRuntimeOptions({ mode: "bogus", scenario: "nope" }),
    ).toEqual({
      diagnosticLogWarning: null,
      diagnosticWarning: "Invalid diagnostic mode; expected capture/playback.",
    });

    expect(parsePlaybackRuntimeOptions({ mode: "playback" })).toEqual({
      diagnosticLogWarning: null,
      diagnosticWarning: "Invalid diagnostic scenario; expected a value.",
    });
  });

  it("warns about unknown diagnostic logs without blocking playback", () => {
    expect(
      parsePlaybackRuntimeOptions({
        log: "full",
        mode: "playback",
        scenario: "moon-circle-long",
      }),
    ).toEqual({
      diagnostic: { mode: "playback", scenario: "moon-circle-long" },
      diagnosticLogWarning: "Invalid diagnostic log; expected circle-now.",
      diagnosticWarning: null,
    });
  });
});
