import {
  circularSpeedAtRadius,
  localFrame,
  mat3,
  vec3,
} from "@solitude/engine/math";
import { createControlInput } from "@solitude/engine/plugin";
import type { ControlledBody, World } from "@solitude/engine/world";
import { createSpacecraftOperatorTelemetry } from "@solitude/sim/plugins/spacecraftOperator/telemetry";
import { describe, expect, it } from "vitest";
import { createHudPanel as createAutopilotHudPanel } from "../autopilot/hud";
import type { HudContext } from "../hud/capabilities";
import type { HudGrid } from "../hud/grid";
import { createHudPanel as createOrbitTelemetryHudPanel } from "../orbitTelemetry/hud";
import { createHudPanel as createRuntimeTelemetryHudPanel } from "../runtimeTelemetry/hud";
import { createRuntimeTelemetryController } from "../runtimeTelemetry/logic";
import { createHudPanel as createShipTelemetryHudPanel } from "../shipTelemetry/hud";

function createHudGrid(): HudGrid {
  return [
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
}

function createWorldAndShip(): { world: World; ship: ControlledBody } {
  const planetId = "planet:earth";
  const shipId = "ship:test";
  const planetMass = 5.972e24;
  const planetRadius = 6_371_000;
  const orbitRadius = planetRadius + 400_000;
  const shipVelocity = circularSpeedAtRadius(planetMass, orbitRadius);

  const ship: ControlledBody = {
    id: shipId,
    position: vec3.create(orbitRadius, 0, 0),
    velocity: vec3.create(0, shipVelocity, 0),
    frame: localFrame.fromUp(vec3.create(0, 0, 1)),
    orientation: mat3.identity,
    angularVelocity: { roll: 0, pitch: 0, yaw: 0 },
  };
  const planet = {
    id: planetId,
    position: vec3.zero(),
    velocity: vec3.zero(),
    orientation: mat3.identity,
    rotationAxis: vec3.create(0, 0, 1),
    angularSpeedRadPerSec: 0,
  };

  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [ship],
    entities: [{ id: shipId }, { id: planetId }],
    entityIndex: new Map(),
    entityStates: [],
    gravityMasses: [],
    lightEmitters: [],
  };
  world.entityIndex.set(shipId, world.entities[0]);
  world.entityIndex.set(planetId, world.entities[1]);
  world.entityStates.push(ship, planet);
  world.collisionSpheres.push({
    id: planetId,
    radius: planetRadius,
    state: planet,
  });
  world.gravityMasses.push(
    { id: shipId, density: 1, mass: 1, state: ship },
    { id: planetId, density: 5_500, mass: planetMass, state: planet },
  );

  return { world, ship };
}

function createHudContext(
  world: World,
  mainFocusBody: ControlledBody,
): HudContext {
  return {
    controlInput: createControlInput(),
    mainFocus: {
      controlledBody: mainFocusBody,
      entityId: mainFocusBody.id,
    },
    nowMs: 1234,
    simTimeMillis: 65_000,
    world,
  };
}

describe("telemetry HUD plugins", () => {
  it("shipTelemetry writes ship state and control cells", () => {
    const { world, ship } = createWorldAndShip();
    ship.velocity = vec3.create(10, 0, 0);
    const grid = createHudGrid();
    const context = createHudContext(world, ship);
    const telemetry = createSpacecraftOperatorTelemetry();
    telemetry.currentThrustLevel = 5;
    telemetry.currentRcsLevel = -1;

    createShipTelemetryHudPanel(telemetry).writeHud(grid, context);

    expect(grid[0][4]).toBe("Speed: 36 km/h");
    expect(grid[1][4]).toBe("Thrust:  5");
    expect(grid[2][4]).toBe("RCS: -1.00");
  });

  it("shipTelemetry reads the focused body instead of the legacy main body", () => {
    const { world, ship } = createWorldAndShip();
    ship.velocity = vec3.create(10, 0, 0);
    const grid = createHudGrid();
    const context = createHudContext(world, ship);
    const telemetry = createSpacecraftOperatorTelemetry();

    createShipTelemetryHudPanel(telemetry).writeHud(grid, context);

    expect(grid[0][4]).toBe("Speed: 36 km/h");
  });

  it("runtimeTelemetry writes simulation time and fps cells", () => {
    const { world, ship } = createWorldAndShip();
    const grid = createHudGrid();
    const context = createHudContext(world, ship);
    const controller = createRuntimeTelemetryController();

    controller.updateFps(1000 / 60);
    createRuntimeTelemetryHudPanel(controller).writeHud(grid, context);

    expect(grid[3][4]).toBe("Time: 01m 05s");
    expect(grid[4][4]).toBe("FPS: 60.0");
  });

  it("orbitTelemetry writes orbit and circularization cells", () => {
    const { world, ship } = createWorldAndShip();
    const grid = createHudGrid();
    const context = createHudContext(world, ship);

    createOrbitTelemetryHudPanel().writeHud(grid, context);

    expect(grid[0][0]).toBe("Orbit: Earth (bound)");
    expect(grid[1][0]).toContain("Pe/Ap: ");
    expect(grid[2][0]).toBe("e: 0.000");
    expect(grid[3][0]).toBe("i: 0.0°");
    expect(grid[0][1]).toContain("Δv Rad: ");
    expect(grid[1][1]).toContain("Δv Tan: ");
  });

  it("orbitTelemetry leaves cells untouched when no primary is available", () => {
    const { world, ship } = createWorldAndShip();
    world.collisionSpheres.length = 0;
    world.gravityMasses.length = 0;
    const grid = createHudGrid();
    grid[0][0] = "existing";
    grid[1][0] = "existing pe/ap";
    const context = createHudContext(world, ship);

    createOrbitTelemetryHudPanel().writeHud(grid, context);

    expect(grid[0][0]).toBe("existing");
    expect(grid[1][0]).toBe("existing pe/ap");
    expect(grid[0][1]).toBe("");
    expect(grid[1][1]).toBe("");
  });

  it("autopilot HUD reads circle-now diagnostics from the focused body", () => {
    const { world, ship } = createWorldAndShip();
    const grid = createHudGrid();
    const context = createHudContext(world, ship);
    context.controlInput.circleNow = true;

    createAutopilotHudPanel().writeHud(grid, context);

    expect(grid[0][3]).toBe("AP: VEL BODY [CN]");
    expect(grid[4][2]).toBe("");
  });
});
