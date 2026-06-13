import { createOrbitTelemetryPlugin } from "@solitude/display/plugins/orbitTelemetry";
import { createShipTelemetryPlugin } from "@solitude/display/plugins/shipTelemetry";
import {
  circularSpeedAtRadius,
  localFrame,
  mat3,
  vec3,
} from "@solitude/engine/math";
import {
  createControlInput,
  type GamePlugin,
  type PluginCapabilityProvider,
} from "@solitude/engine/plugin";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import type { ControlledBody, World } from "@solitude/engine/world";
import {
  createHudGrid,
  getHudColumnIndex,
  hudPanelCapability,
  isHudPanelProvider,
  type HudColumnId,
  type HudContext,
  type HudGrid,
  type HudPanelProvider,
} from "@solitude/sim/hud/provider";
import { createEntityNameProvider } from "@solitude/sim/localization";
import { createAutopilotPlugin } from "@solitude/sim/plugins/autopilot";
import { createSpacecraftOperatorTelemetryProvider } from "@solitude/sim/plugins/spacecraftOperator/capabilities";
import { createSpacecraftOperatorTelemetry } from "@solitude/sim/plugins/spacecraftOperator/telemetry";
import { describe, expect, it } from "vitest";
import { createHudPanel as createRuntimeTelemetryHudPanel } from "../runtimeTelemetry/hud";
import { createRuntimeTelemetryLocalization } from "../runtimeTelemetry/localization";
import { createRuntimeTelemetryController } from "../runtimeTelemetry/logic";

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
  capabilities: readonly PluginCapabilityProvider[] = [],
): HudContext {
  return {
    capabilityRegistry: createPluginCapabilityRegistry(capabilities),
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
    const panel = getHudPanel(createShipTelemetryPlugin({ locale: "en" }));
    const grid = createHudGrid();
    const telemetry = createSpacecraftOperatorTelemetry();
    telemetry.currentThrustLevel = 5;
    telemetry.currentRcsLevel = -1;
    const context = createHudContext(world, ship, [
      createSpacecraftOperatorTelemetryProvider(telemetry),
    ]);

    panel.writeHud(grid, context);

    expect(columnTexts(grid, "right")).toEqual([
      "Speed: 36 km/h",
      "Thrust:  5",
      "RCS: -1.00",
    ]);
  });

  it("shipTelemetry writes localized speed without thousands separators", () => {
    const { world, ship } = createWorldAndShip();
    ship.velocity = vec3.create(29_579.72, 0, 0);
    const panel = getHudPanel(createShipTelemetryPlugin({ locale: "es" }));
    const grid = createHudGrid();
    const telemetry = createSpacecraftOperatorTelemetry();
    telemetry.currentRcsLevel = 1.25;
    const context = createHudContext(world, ship, [
      createSpacecraftOperatorTelemetryProvider(telemetry),
    ]);

    panel.writeHud(grid, context);

    expect(columnTexts(grid, "right")).toEqual([
      "Velocidad: 106487 km/h",
      "Empuje:  0",
      "RCS:  1,25",
    ]);
  });

  it("shipTelemetry reads the focused body instead of the legacy main body", () => {
    const { world, ship } = createWorldAndShip();
    ship.velocity = vec3.create(10, 0, 0);
    const panel = getHudPanel(createShipTelemetryPlugin({ locale: "en" }));
    const grid = createHudGrid();
    const context = createHudContext(world, ship);

    panel.writeHud(grid, context);

    expect(columnTexts(grid, "right")).toEqual(["Speed: 36 km/h"]);
  });

  it("shipTelemetry caches the spacecraft operator telemetry provider", () => {
    const { world, ship } = createWorldAndShip();
    const grid = createHudGrid();
    const telemetry = createSpacecraftOperatorTelemetry();
    telemetry.currentThrustLevel = 7;
    const capabilities = [createSpacecraftOperatorTelemetryProvider(telemetry)];
    let lookupCount = 0;
    const context = createHudContext(world, ship);
    context.capabilityRegistry = {
      getAll: (id) => {
        lookupCount++;
        return id === "spacecraft.operatorTelemetry.v1"
          ? capabilities.map((capability) => capability.value)
          : [];
      },
    };
    const panel = getHudPanel(createShipTelemetryPlugin({ locale: "en" }));

    panel.writeHud(grid, context);
    panel.writeHud(grid, context);

    expect(lookupCount).toBe(1);
    expect(columnTexts(grid, "right")).toContain("Thrust:  7");
  });

  it("runtimeTelemetry writes simulation time and fps cells", () => {
    const { world, ship } = createWorldAndShip();
    const localization = createRuntimeTelemetryLocalization("en");
    const grid = createHudGrid();
    const context = createHudContext(world, ship);
    const controller = createRuntimeTelemetryController();
    controller.updateFps(1000 / 60);
    const panel = createRuntimeTelemetryHudPanel(controller, localization);
    panel.writeHud(grid, context);

    expect(columnTexts(grid, "center")).toEqual(["Time: 01m 05s", "FPS: 60.0"]);
  });

  it("orbitTelemetry writes orbit and circularization cells", () => {
    const { world, ship } = createWorldAndShip();
    const panel = getHudPanel(createOrbitTelemetryPlugin({ locale: "en" }));
    const grid = createHudGrid();
    const context = createHudContext(world, ship);
    panel.writeHud(grid, context);

    expect(columnTexts(grid, "left")[0]).toBe("Orbit: Earth (bound)");
    expect(columnTexts(grid, "left")[1]).toContain("Pe/Ap: ");
    expect(columnTexts(grid, "left")[2]).toBe("e: 0.000");
    expect(columnTexts(grid, "left")[3]).toBe("i: 0.0°");
    expect(columnTexts(grid, "leftCenter")[0]).toContain("Δv Rad: ");
    expect(columnTexts(grid, "leftCenter")[1]).toContain("Δv Tan: ");
  });

  it("orbitTelemetry localizes primary body names", () => {
    const { world, ship } = createWorldAndShip();
    const panel = getHudPanel(createOrbitTelemetryPlugin({ locale: "es" }));
    const grid = createHudGrid();
    const context = createHudContext(world, ship, [
      createEntityNameProvider({
        formatEntityName: (entityId) =>
          entityId === "planet:earth" ? "Tierra" : null,
      }),
    ]);
    panel.writeHud(grid, context);

    expect(columnTexts(grid, "left")[0]).toBe("Órbita: Tierra (ligada)");
    expect(columnTexts(grid, "left")[2]).toBe("e: 0,000");
    expect(columnTexts(grid, "left")[3]).toBe("i: 0,0°");
  });

  it("orbitTelemetry leaves cells untouched when no primary is available", () => {
    const { world, ship } = createWorldAndShip();
    world.collisionSpheres.length = 0;
    world.gravityMasses.length = 0;
    const panel = getHudPanel(createOrbitTelemetryPlugin({ locale: "en" }));
    const grid = createHudGrid();
    const context = createHudContext(world, ship);

    panel.writeHud(grid, context);

    expect(columnTexts(grid, "left")).toEqual([]);
    expect(columnTexts(grid, "leftCenter")).toEqual([]);
  });

  it("autopilot HUD reads circle-now diagnostics from the focused body", () => {
    const { world, ship } = createWorldAndShip();
    const panel = getHudPanel(createAutopilotPlugin({ locale: "en" }));
    const grid = createHudGrid();
    const context = createHudContext(world, ship);
    context.controlInput.circleNow = true;

    panel.writeHud(grid, context);

    expect(columnTexts(grid, "rightCenter")).toEqual(["AP: VEL BODY [CN]"]);
    expect(columnTexts(grid, "center")).toEqual([]);
  });

  it("HUD lines with the same key update or append in place", () => {
    const grid = createHudGrid();

    grid.addLine("rightCenter", "runtime.timeScale", "Scale: 2");
    grid.addLine("rightCenter", "runtime.timeScale", "Scale: 4");
    grid.appendLine("center", "runtime.status", "PAUSE");
    grid.appendLine("center", "runtime.status", "PROFILING");

    expect(columnTexts(grid, "rightCenter")).toEqual(["Scale: 4"]);
    expect(columnTexts(grid, "center")).toEqual(["PAUSE PROFILING"]);
  });
});

function columnTexts(grid: HudGrid, column: HudColumnId): string[] {
  return grid.columns[getHudColumnIndex(column)].map((line) => line.text);
}

function getHudPanel(plugin: GamePlugin): HudPanelProvider {
  const provider = plugin.capabilities?.find(
    (capability) =>
      capability.id === hudPanelCapability &&
      isHudPanelProvider(capability.value),
  );
  if (!provider || !isHudPanelProvider(provider.value)) {
    throw new Error(`Plugin ${plugin.id} did not provide a HUD panel`);
  }
  return provider.value;
}
