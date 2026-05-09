import { describe, expect, it } from "vitest";
import { parseRuntimeOptionsFromSearch } from "./domRuntimeOptions";

describe("dom runtime options", () => {
  it("parses query params as a raw string map", () => {
    expect(
      parseRuntimeOptionsFromSearch(
        "?mode=playback&scenario=moon-circle-long&log=circle-now&autopilot=v1",
      ),
    ).toEqual({
      autopilot: "v1",
      log: "circle-now",
      mode: "playback",
      scenario: "moon-circle-long",
    });
  });

  it("keeps unknown options for plugins to interpret", () => {
    expect(parseRuntimeOptionsFromSearch("?unknown=yes")).toEqual({
      unknown: "yes",
    });
  });

  it("uses the last value when an option appears more than once", () => {
    expect(parseRuntimeOptionsFromSearch("?autopilot=v1&autopilot=v2")).toEqual(
      {
        autopilot: "v2",
      },
    );
  });
});
