import { describe, expect, it } from "vitest";
import { parseAutopilotRuntimeOptions } from "./options";

describe("autopilot runtime options", () => {
  it("defaults to v5", () => {
    expect(parseAutopilotRuntimeOptions({})).toEqual({
      algorithmVersion: "v5",
      warning: null,
    });
  });

  it("accepts v1, v2, v3, v4, and v5", () => {
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
    expect(parseAutopilotRuntimeOptions({ autopilot: "v4" })).toEqual({
      algorithmVersion: "v4",
      warning: null,
    });
    expect(parseAutopilotRuntimeOptions({ autopilot: "v5" })).toEqual({
      algorithmVersion: "v5",
      warning: null,
    });
  });

  it("falls back and warns for invalid values", () => {
    expect(parseAutopilotRuntimeOptions({ autopilot: "v9" })).toEqual({
      algorithmVersion: "v5",
      warning: "Invalid autopilot; expected v1/v2/v3/v4/v5.",
    });
  });
});
