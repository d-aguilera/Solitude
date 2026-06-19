import { describe, expect, it } from "vitest";
import { resolveRendererBackend } from "./rendererBackend";

describe("renderer backend", () => {
  it("uses WebGL by default and for unknown values", () => {
    expect(resolveRendererBackend({})).toBe("webgl");
    expect(resolveRendererBackend({ renderer: "future" })).toBe("webgl");
  });

  it("uses Canvas only for the explicit override", () => {
    expect(resolveRendererBackend({ renderer: "canvas" })).toBe("canvas");
  });
});
