import { describe, expect, it } from "vitest";
import { buildEntityConfigIndex } from "../entityConfig";
import type { EntityConfig } from "../entityConfigPorts";

describe("buildEntityConfigIndex", () => {
  it("indexes entity ids by generic capability", () => {
    const entities: EntityConfig[] = [
      {
        id: "planet:test",
        components: {
          axialSpin: {
            angularSpeedRadPerSec: 1,
            obliquityRad: 0,
          },
          collisionSphere: {
            radius: 10,
          },
          gravityMass: {
            density: 1,
            physicalRadius: 10,
          },
        },
      },
      {
        id: "ship:test",
        components: {
          controllable: {
            enabled: true,
          },
        },
      },
    ];

    const index = buildEntityConfigIndex(entities);

    expect(index.byId.get("planet:test")).toBe(entities[0]);
    expect(index.axialSpinEntityIds).toEqual(["planet:test"]);
    expect(index.collisionSphereEntityIds).toEqual(["planet:test"]);
    expect(index.gravityMassEntityIds).toEqual(["planet:test"]);
    expect(index.controllableEntityIds).toEqual(["ship:test"]);
  });

  it("fails clearly for duplicate entity ids", () => {
    const entities: EntityConfig[] = [
      { id: "ship:test", components: {} },
      { id: "ship:test", components: {} },
    ];

    expect(() => buildEntityConfigIndex(entities)).toThrow(
      "Duplicate entity config id: ship:test",
    );
  });
});
