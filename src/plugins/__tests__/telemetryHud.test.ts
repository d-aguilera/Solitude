import { describe, expect, it } from "vitest";
import { createControlInput } from "../../app/controlPorts";
import type { HudGrid } from "../../app/hudPorts";
import type { HudContext } from "../../app/pluginPorts";
import type { ShipBody, World } from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { circularSpeedAtRadius } from "../../domain/phys";
import { vec3 } from "../../domain/vec3";
import { createHudPlugin as createOrbitTelemetryHudPlugin } from "../orbitTelemetry/hud";
import { createHudPlugin as createRuntimeTelemetryHudPlugin } from "../runtimeTelemetry/hud";
import { createRuntimeTelemetryController } from "../runtimeTelemetry/logic";
import { createHudPlugin as createShipTelemetryHudPlugin } from "../shipTelemetry/hud";

function createHudGrid(): HudGrid {
  return [
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
}

function createWorldAndShip(): { world: World; ship: ShipBody } {
  const planetId = "planet:earth";
  const shipId = "ship:test";
  const planetMass = 5.972e24;
  const planetRadius = 6_371_000;
  const orbitRadius = planetRadius + 400_000;
  const shipVelocity = circularSpeedAtRadius(planetMass, orbitRadius);

  const ship: ShipBody = {
    id: shipId,
    position: vec3.create(orbitRadius, 0, 0),
    velocity: vec3.create(0, shipVelocity, 0),
    frame: localFrame.fromUp(vec3.create(0, 0, 1)),
    orientation: mat3.identity,
    angularVelocity: { roll: 0, pitch: 0, yaw: 0 },
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
    ships: [ship],
    shipPhysics: [{ id: shipId, density: 1, mass: 1 }],
    planets: [
      {
        id: planetId,
        position: vec3.zero(),
        velocity: vec3.zero(),
        orientation: mat3.identity,
        rotationAxis: vec3.create(0, 0, 1),
        angularSpeedRadPerSec: 0,
      },
    ],
    planetPhysics: [
      {
        id: planetId,
        density: 5_500,
        mass: planetMass,
        physicalRadius: planetRadius,
      },
    ],
    stars: [],
    starPhysics: [],
  };
  world.entityIndex.set(shipId, world.entities[0]);
  world.entityIndex.set(planetId, world.entities[1]);
  world.entityStates.push(ship, world.planets[0]);
  world.collisionSpheres.push({
    id: planetId,
    radius: planetRadius,
    state: world.planets[0],
  });
  world.gravityMasses.push(
    { id: shipId, density: 1, mass: 1, state: ship },
    { id: planetId, density: 5_500, mass: planetMass, state: world.planets[0] },
  );

  return { world, ship };
}

function createHudContext(world: World, mainShip: ShipBody): HudContext {
  return {
    controlInput: createControlInput(),
    currentRcsLevel: -1,
    currentThrustLevel: 5,
    mainShip,
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

    createShipTelemetryHudPlugin().updateHudParams(grid, context);

    expect(grid[0][4]).toBe("Speed: 36 km/h");
    expect(grid[1][4]).toBe("Thrust:  5");
    expect(grid[2][4]).toBe("RCS: -1.00");
  });

  it("runtimeTelemetry writes simulation time and fps cells", () => {
    const { world, ship } = createWorldAndShip();
    const grid = createHudGrid();
    const context = createHudContext(world, ship);
    const controller = createRuntimeTelemetryController();

    controller.updateFps(1000 / 60);
    createRuntimeTelemetryHudPlugin(controller).updateHudParams(grid, context);

    expect(grid[3][4]).toBe("Time: 01m 05s");
    expect(grid[4][4]).toBe("FPS: 60.0");
  });

  it("orbitTelemetry writes orbit and circularization cells", () => {
    const { world, ship } = createWorldAndShip();
    const grid = createHudGrid();
    const context = createHudContext(world, ship);

    createOrbitTelemetryHudPlugin().updateHudParams(grid, context);

    expect(grid[0][0]).toBe("Orbit: Earth (bound)");
    expect(grid[1][0]).toContain("Pe/Ap: ");
    expect(grid[2][0]).toBe("e: 0.000");
    expect(grid[3][0]).toBe("i: 0.0°");
    expect(grid[0][1]).toContain("Δv Rad: ");
    expect(grid[1][1]).toContain("Δv Tan: ");
  });
});
