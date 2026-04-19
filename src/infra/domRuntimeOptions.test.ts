import { describe, expect, it } from "vitest";
import { parseRuntimeOptionsFromSearch } from "./domRuntimeOptions";

describe("dom runtime options", () => {
  it("parses capture diagnostics", () => {
    expect(
      parseRuntimeOptionsFromSearch("?mode=capture&scenario=moon-circle"),
    ).toEqual({
      diagnostic: { mode: "capture", scenario: "moon-circle" },
    });
  });

  it("parses playback diagnostics", () => {
    expect(
      parseRuntimeOptionsFromSearch("?mode=playback&scenario=moon-circle"),
    ).toEqual({
      diagnostic: { mode: "playback", scenario: "moon-circle" },
    });
  });

  it("fails closed for invalid diagnostics", () => {
    expect(parseRuntimeOptionsFromSearch("?mode=bogus&scenario=nope")).toEqual({
      diagnosticWarning: "Invalid diagnostic mode; expected capture/playback.",
    });
  });

  it("accepts arbitrary non-empty scenario ids", () => {
    expect(
      parseRuntimeOptionsFromSearch("?mode=capture&scenario=whatever-next"),
    ).toEqual({
      diagnostic: { mode: "capture", scenario: "whatever-next" },
    });
  });

  it("fails closed for missing scenario ids", () => {
    expect(parseRuntimeOptionsFromSearch("?mode=playback")).toEqual({
      diagnosticWarning: "Invalid diagnostic scenario; expected a value.",
    });
  });
});
