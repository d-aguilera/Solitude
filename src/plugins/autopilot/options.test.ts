import { describe, expect, it } from "vitest";
import { parseAutopilotRuntimeOptions } from "./options";

describe("autopilot runtime options", () => {
  it("defaults to v3", () => {
    expect(parseAutopilotRuntimeOptions({})).toEqual({
      algorithmVersion: "v3",
      warning: null,
    });
  });

  it("accepts v1, v2, and v3", () => {
    expect(parseAutopilotRuntimeOptions({ autopilot: "v1" })).toEqual({
      algorithmVersion: "v1",
      warning: null,
    });
    expect(parseAutopilotRuntimeOptions({ autopilot: "v2" })).toEqual({
      algorithmVersion: "v2",
      warning: null,
    });
    expect(parseAutopilotRuntimeOptions({ autopilot: "v3" })).toEqual({
      algorithmVersion: "v3",
      warning: null,
    });
  });

  it("falls back and warns for invalid values", () => {
    expect(parseAutopilotRuntimeOptions({ autopilot: "v9" })).toEqual({
      algorithmVersion: "v3",
      warning: "Invalid autopilot; expected v1/v2/v3.",
    });
  });
});
