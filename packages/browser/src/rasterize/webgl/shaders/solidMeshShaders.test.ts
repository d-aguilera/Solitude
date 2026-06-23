import { describe, expect, it } from "vitest";
import fragmentShaderSource from "./solidMesh.frag.glsl?raw";
import vertexShaderSource from "./solidMesh.vert.glsl?raw";

describe("solid mesh shaders", () => {
  it("interpolates lighting intensity for smooth sphere shading", () => {
    expect(vertexShaderSource).toContain("out float vIntensity;");
    expect(fragmentShaderSource).toContain("in float vIntensity;");
    expect(vertexShaderSource).not.toContain("flat out float vIntensity;");
    expect(fragmentShaderSource).not.toContain("flat in float vIntensity;");
  });
});
