import { describe, expect, it } from "vitest";
import { parseAutopilotRuntimeOptions } from "./options";

describe("autopilot runtime options", () => {
  it("defaults to v2", () => {
    expect(parseAutopilotRuntimeOptions({})).toEqual({
      algorithmVersion: "v2",
      warning: null,
    });
  });

  it("accepts v1 and v2", () => {
    expect(parseAutopilotRuntimeOptions({ autopilot: "v1" })).toEqual({
      algorithmVersion: "v1",
      warning: null,
    });
    expect(parseAutopilotRuntimeOptions({ autopilot: "v2" })).toEqual({
      algorithmVersion: "v2",
      warning: null,
    });
  });

  it("falls back and warns for invalid values", () => {
    expect(parseAutopilotRuntimeOptions({ autopilot: "v9" })).toEqual({
      algorithmVersion: "v2",
      warning: "Invalid autopilot; expected v1/v2.",
    });
  });
});
