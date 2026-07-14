import { vec3 } from "@solitude/plugin-api/math";
import {
  createSpacecraftOperatorTelemetryProvider,
  spacecraftOperatorTelemetryCapability,
} from "@solitude/plugin-api/telemetry";
import { describe, expect, it } from "vitest";
import {
  columnTexts,
  createTestHudContext,
  createTestHudGrid,
  createTestWorldAndBody,
  getHudPanel,
} from "../shared/hudTest";
import { createPlugin } from "./index";

describe("ship telemetry plugin", () => {
  it("writes ship state and control cells", () => {
    const { world, body } = createTestWorldAndBody();
    body.velocity = vec3.create(10, 0, 0);
    const panel = getHudPanel(createPlugin({ locale: "en" }));
    const grid = createTestHudGrid();
    const context = createTestHudContext(world, body, [
      createSpacecraftOperatorTelemetryProvider({
        currentRcsLevel: -1,
        currentThrustLevel: 5,
      }),
    ]);

    panel.writeHud(grid, context);

    expect(columnTexts(grid, "right")).toEqual([
      "Speed: 36 km/h",
      "Thrust:  5",
      "RCS: -1.00",
    ]);
  });

  it("writes localized speed without thousands separators", () => {
    const { world, body } = createTestWorldAndBody();
    body.velocity = vec3.create(29_579.72, 0, 0);
    const panel = getHudPanel(createPlugin({ locale: "es" }));
    const grid = createTestHudGrid();
    const context = createTestHudContext(world, body, [
      createSpacecraftOperatorTelemetryProvider({
        currentRcsLevel: 1.25,
        currentThrustLevel: 0,
      }),
    ]);

    panel.writeHud(grid, context);

    expect(columnTexts(grid, "right")).toEqual([
      "Velocidad: 106487 km/h",
      "Empuje:  0",
      "RCS:  1,25",
    ]);
  });

  it("writes only speed when spacecraft telemetry is unavailable", () => {
    const { world, body } = createTestWorldAndBody();
    body.velocity = vec3.create(10, 0, 0);
    const panel = getHudPanel(createPlugin({ locale: "en" }));
    const grid = createTestHudGrid();

    panel.writeHud(grid, createTestHudContext(world, body));

    expect(columnTexts(grid, "right")).toEqual(["Speed: 36 km/h"]);
  });

  it("caches the spacecraft operator telemetry provider", () => {
    const { world, body } = createTestWorldAndBody();
    const grid = createTestHudGrid();
    const capability = createSpacecraftOperatorTelemetryProvider({
      currentRcsLevel: 0,
      currentThrustLevel: 7,
    });
    let lookupCount = 0;
    const context = createTestHudContext(world, body);
    context.capabilityRegistry = {
      getAll: (id) => {
        lookupCount++;
        return id === spacecraftOperatorTelemetryCapability
          ? [capability.value]
          : [];
      },
    };
    const panel = getHudPanel(createPlugin({ locale: "en" }));

    panel.writeHud(grid, context);
    panel.writeHud(grid, context);

    expect(lookupCount).toBe(1);
    expect(columnTexts(grid, "right")).toContain("Thrust:  7");
  });
});
