import {
  controllableEntityProviderCapability,
  isControllableEntityProvider,
} from "@solitude/plugin-api/controllable-entities";
import { mat3, vec3 } from "@solitude/plugin-api/math";
import { describe, expect, it } from "vitest";
import { createPlugin } from "./index";

describe("poly fighter plugin", () => {
  it("publishes a provider that creates the controllable fighter model", () => {
    const capability = createPlugin({}).capabilities?.find(
      ({ id }) => id === controllableEntityProviderCapability,
    );
    expect(isControllableEntityProvider(capability?.value)).toBe(true);
    if (!isControllableEntityProvider(capability?.value)) return;

    const entity = capability.value.createEntity({
      color: { r: 10, g: 20, b: 30 },
      id: "ship:test",
      placement: {
        angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
        frame: {
          forward: vec3.create(0, 1, 0),
          right: vec3.create(1, 0, 0),
          up: vec3.create(0, 0, 1),
        },
        orientation: mat3.identity,
        position: vec3.create(1, 2, 3),
        velocity: vec3.create(4, 5, 6),
      },
    });

    expect(capability.value.mass).toBeGreaterThan(0);
    expect(entity.id).toBe("ship:test");
    expect(entity.components.controllable).toEqual({ enabled: true });
    expect(entity.components.renderable?.color).toEqual({
      r: 10,
      g: 20,
      b: 30,
    });
    expect(entity.components.renderable?.mesh.points.length).toBeGreaterThan(0);
  });
});
