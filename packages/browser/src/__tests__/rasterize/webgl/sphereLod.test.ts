import { describe, expect, it } from "vitest";
import { chooseUnitIcosphereSubdivisions } from "../../../rasterize/webgl/sphereLod";

describe("sphere LOD", () => {
  it("chooses lower subdivisions for small projected diameters", () => {
    expect(chooseUnitIcosphereSubdivisions(8, 4)).toBe(0);
    expect(chooseUnitIcosphereSubdivisions(32, 4)).toBe(1);
    expect(chooseUnitIcosphereSubdivisions(100, 4)).toBe(2);
    expect(chooseUnitIcosphereSubdivisions(300, 4)).toBe(3);
    expect(chooseUnitIcosphereSubdivisions(900, 4)).toBe(4);
  });

  it("does not exceed the configured max subdivisions", () => {
    expect(chooseUnitIcosphereSubdivisions(900, 2)).toBe(2);
    expect(chooseUnitIcosphereSubdivisions(300, 2)).toBe(2);
  });
});
