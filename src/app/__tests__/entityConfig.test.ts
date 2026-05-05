import { describe, expect, it } from "vitest";
import { buildEntityConfigIndex } from "../entityConfig";
import type { EntityConfig } from "../entityConfigPorts";

describe("buildEntityConfigIndex", () => {
  it("indexes entity ids by generic capability", () => {
    const entities: EntityConfig[] = [
      {
        id: "body:test",
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
        id: "craft:test",
        components: {
          controllable: {
            enabled: true,
          },
        },
      },
    ];

    const index = buildEntityConfigIndex(entities);

    expect(index.byId.get("body:test")).toBe(entities[0]);
    expect(index.axialSpinEntityIds).toEqual(["body:test"]);
    expect(index.collisionSphereEntityIds).toEqual(["body:test"]);
    expect(index.gravityMassEntityIds).toEqual(["body:test"]);
    expect(index.controllableEntityIds).toEqual(["craft:test"]);
  });

  it("fails clearly for duplicate entity ids", () => {
    const entities: EntityConfig[] = [
      { id: "craft:test", components: {} },
      { id: "craft:test", components: {} },
    ];

    expect(() => buildEntityConfigIndex(entities)).toThrow(
      "Duplicate entity config id: craft:test",
    );
  });
});
