import type { ExternalAttitudeCommandParams } from "@solitude/plugin-api/controls";
import { vec3 } from "@solitude/plugin-api/math";
import { spacecraftVelocityReferenceCapability } from "@solitude/plugin-api/spacecraft";
import type { ExternalControlledBody } from "@solitude/plugin-api/world";
import { describe, expect, it } from "vitest";
import { createPlugin } from "../index";

function setup(referenceIds: (string | null)[]) {
  const plugin = createPlugin();
  const body: ExternalControlledBody = {
    id: "craft",
    position: vec3.zero(),
    velocity: { x: 30_000, y: 7500, z: 0 },
    angularVelocity: { pitch: 0, yaw: 0, roll: 0 },
    frame: {
      forward: { x: 0, y: 1, z: 0 },
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 0, z: 1 },
    },
  };
  const earth = {
    id: "earth",
    position: vec3.zero(),
    velocity: { x: 30_000, y: 0, z: 0 },
  };
  plugin.hooks!.worldModel!.contributeWorldModel(
    { addEntities: () => {}, setMainFocusEntityId: () => {} },
    {
      capabilityRegistry: {
        getAll: (id) =>
          id === spacecraftVelocityReferenceCapability
            ? referenceIds.map((reference) => ({
                getReferenceEntityId: () => reference,
              }))
            : [],
      },
    },
  );
  const params: ExternalAttitudeCommandParams = {
    dtMillis: 16,
    controlledBody: body,
    controlInput: { alignToVelocity: true },
    controlState: {},
    world: {
      entityStates: [body, earth],
      collisionSpheres: [],
      gravityMasses: [],
      controllableBodies: [body],
    },
  };
  return {
    command: () => plugin.hooks!.controls!.getAttitudeCommand!(params),
    params,
    earth,
  };
}

describe("opt-in autopilot velocity reference", () => {
  it("aligns to Earth-relative velocity while default behavior retains world velocity", () => {
    expect(setup(["earth"]).command()).toBeNull();
    expect(setup([]).command()?.yaw).not.toBe(0);
    expect(setup([null]).command()?.yaw).not.toBe(0);
  });
  it("does not fall back when a requested reference is missing, invalid, or stationary relative to the craft", () => {
    expect(setup(["missing"]).command()).toBeNull();
    const invalid = setup(["earth"]);
    invalid.earth.velocity.x = NaN;
    expect(invalid.command()).toBeNull();
    const stationary = setup(["earth"]);
    stationary.earth.velocity = {
      ...stationary.params.controlledBody.velocity,
    };
    expect(stationary.command()).toBeNull();
  });
  it("rejects two active providers even when they request the same reference", () => {
    expect(() => setup(["earth", "earth"]).command()).toThrow("Conflicting");
  });
});
