import type { ExternalControlInput } from "@solitude/plugin-api/input";
import type { ExternalLoopUpdateParams } from "@solitude/plugin-api/loop";
import { vec3 } from "@solitude/plugin-api/math";
import type { ExternalSimulationPhaseParams } from "@solitude/plugin-api/simulation";
import type { ExternalRuntimeSnapshotService } from "@solitude/plugin-api/snapshots";
import type {
  ExternalControlledBody,
  ExternalWorld,
} from "@solitude/plugin-api/world";
import { describe, expect, it, vi } from "vitest";
import { createPlaybackController } from "../../playback/core";
import type { PlaybackScript } from "../../playback/types";

const snapshots: ExternalRuntimeSnapshotService = {
  apply: () => true,
  capture: () => ({ entities: [] }),
};

function createShip(id: string): ExternalControlledBody {
  const ship: ExternalControlledBody = {
    angularVelocity: { roll: 0, pitch: 0, yaw: 0 },
    id,
    position: vec3.create(1, 0, 0),
    velocity: vec3.create(0, 1, 0),
    frame: {
      forward: vec3.create(1, 0, 0),
      right: vec3.create(0, -1, 0),
      up: vec3.create(0, 0, 1),
    },
  };
  return ship;
}

function createWorldAndShip(): {
  world: ExternalWorld;
  ship: ExternalControlledBody;
} {
  const ship = createShip("ship:test");
  const world: ExternalWorld = {
    collisionSpheres: [],
    controllableBodies: [ship],
    entityStates: [ship],
    gravityMasses: [{ id: ship.id, mass: 1, state: ship }],
  };
  return { world, ship };
}

function createWorldWithShips(): {
  red: ExternalControlledBody;
  blue: ExternalControlledBody;
  world: ExternalWorld;
} {
  const blue = createShip("ship:blue");
  const red = createShip("ship:red");
  const world: ExternalWorld = {
    collisionSpheres: [],
    controllableBodies: [blue, red],
    entityStates: [blue, red],
    gravityMasses: [
      { id: blue.id, mass: 1, state: blue },
      { id: red.id, mass: 1, state: red },
    ],
  };
  return { red, blue, world };
}

describe("playback controller", () => {
  it("records and dumps a script in capture mode", () => {
    const { world, ship } = createWorldAndShip();
    const controller = createPlaybackController(
      {
        mode: "capture",
        scenario: "moon-circle",
      },
      snapshots,
    );
    const controlInput = createControlInput(["circleNow"]);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    controller.handleCaptureToggle();
    const startResult = controller.updateLoop(
      controlInput,
      world,
      ship,
      ship.id,
      100,
      5000,
      5,
    );
    controlInput.circleNow = true;
    controller.updateLoop(controlInput, world, ship, ship.id, 1100, 6000, 5);
    controller.handleCaptureToggle();
    controller.updateLoop(controlInput, world, ship, ship.id, 2100, 7000, 5);

    expect(controller.getStatus()).toBe("capture-idle");
    expect(startResult).toBeNull();
    expect(
      info.mock.calls.some((call) => String(call[0]).includes("phases")),
    ).toBe(true);
    expect(
      info.mock.calls.some((call) =>
        String(call[0]).includes("export const playbackScript"),
      ),
    ).toBe(true);
    expect(
      info.mock.calls.some((call) =>
        String(call[0]).includes('"timeScale": 5'),
      ),
    ).toBe(true);

    info.mockRestore();
  });

  it("records focus changes as phase boundaries during capture", () => {
    const { red, blue, world } = createWorldWithShips();
    const controller = createPlaybackController(
      {
        mode: "capture",
        scenario: "moon-circle",
      },
      snapshots,
    );
    const controlInput = createControlInput(["circleNow"]);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    controller.handleCaptureToggle();
    controller.updateLoop(controlInput, world, blue, blue.id, 100, 5000, 5);
    controller.updateLoop(controlInput, world, red, red.id, 1100, 6000, 5);
    controller.handleCaptureToggle();
    controller.updateLoop(controlInput, world, red, red.id, 2100, 7000, 5);

    const dumpedScript = String(
      info.mock.calls.find((call) =>
        String(call[0]).includes("export const playbackScript"),
      )?.[0] ?? "",
    );
    expect(dumpedScript).toContain('"focusEntityId": "ship:blue"');
    expect(dumpedScript).toContain('"focusEntityId": "ship:red"');

    info.mockRestore();
  });

  it("fails closed when playback script is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const controller = createPlaybackController(
      {
        mode: "playback",
        scenario: "unregistered",
      },
      snapshots,
    );
    const controlInput = createControlInput(["pauseToggle"]);

    const result = controller.updateLoop(
      controlInput,
      undefined,
      undefined,
      undefined,
      0,
      0,
    );

    expect(controller.getStatus()).toBe("missing");
    expect(result?.framePolicy?.advanceSim).toBe(false);

    controller.handlePause();
    controller.updateLoop(controlInput, undefined, undefined, undefined, 16, 0);

    expect(controller.getStatus()).toBe("released");
    warn.mockRestore();
  });

  it("uses the script fixed step and time scale during playback", () => {
    const script = createPlaybackScript(20, 7);
    const controller = createPlaybackController(
      {
        mode: "playback",
        scenario: script.id,
      },
      snapshots,
      undefined,
      () => script,
    );
    const controlInput = createControlInput(["pauseToggle", "circleNow"]);

    expect(controller.getStatus()).toBe("waiting");
    expect(controller.getEffectiveTimeScale()).toBe(7);

    controller.handlePause();
    const result = controller.updateLoop(
      controlInput,
      undefined,
      undefined,
      undefined,
      100,
      0,
    );

    expect(controller.getStatus()).toBe("playing");
    expect(result?.framePolicy?.advanceSim).toBe(true);
    expect(result?.framePolicy?.advanceScene).toBe(true);
    expect(result?.framePolicy?.tickDtMillis).toBe(20);
    expect(result?.framePolicy?.simDtMillis).toBe(140);
    expect(controlInput.circleNow).toBe(true);
  });

  it("temporarily targets recorded focus for vehicle dynamics and restores viewed focus", () => {
    const { red, blue, world } = createWorldWithShips();
    const script = createPlaybackScript(20, 1, 100, "ship:blue");
    const controller = createPlaybackController(
      {
        mode: "playback",
        scenario: script.id,
      },
      snapshots,
      undefined,
      () => script,
    );
    const controlInput = createControlInput(["pauseToggle", "circleNow"]);
    const mainFocus: ExternalSimulationPhaseParams["mainFocus"] = {
      controlledBody: red,
      entityId: red.id,
    };
    const simulationParams: ExternalSimulationPhaseParams = {
      controlInput,
      controlInputsByEntityId: new Map(),
      dtMillis: 20,
      dtMillisSim: 20,
      focusEntity: (id) => {
        const body = world.controllableBodies.find((item) => item.id === id);
        if (!body) throw new Error(`Missing controlled body: ${id}`);
        mainFocus.controlledBody = body;
        mainFocus.entityId = id;
      },
      mainFocus,
      world,
    };

    controller.handlePause();
    controller.updateLoop(controlInput, world, red, red.id, 0, 0);
    controller.beforeVehicleDynamics(simulationParams);

    expect(mainFocus.entityId).toBe(blue.id);
    expect(mainFocus.controlledBody).toBe(blue);

    controller.afterVehicleDynamics(simulationParams);

    expect(mainFocus.entityId).toBe(red.id);
    expect(mainFocus.controlledBody).toBe(red);
  });

  it("emits a requested diagnostic log at playback end", () => {
    const { world, ship } = createWorldAndShip();
    const script = createPlaybackScript(20, 1, 20);
    const controller = createPlaybackController(
      {
        log: "circle-now",
        mode: "playback",
        scenario: script.id,
      },
      snapshots,
      undefined,
      () => script,
    );
    const controlInput = createControlInput(["pauseToggle", "circleNow"]);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const params: ExternalLoopUpdateParams = {
      controlInput,
      dtMillis: 20,
      focusEntity: () => {},
      mainFocus: {
        controlledBody: ship,
        entityId: ship.id,
      },
      nowMs: 20,
      simTimeMillis: 20,
      state: {
        framePolicy: {
          advancePresentation: true,
          advanceScene: true,
          advanceSim: true,
          simDtMillis: 20,
          tickDtMillis: 20,
        },
      },
      world,
    };

    controller.handlePause();
    controller.updateLoop(controlInput, world, ship, ship.id, 0, 0);
    controller.afterFrame(params);
    controller.updateLoop(controlInput, world, ship, ship.id, 20, 20);
    controller.afterFrame(params);

    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0][0])).toContain(
      "Solitude diagnostic log: circle-now custom-playback",
    );

    info.mockRestore();
  });
});

function createPlaybackScript(
  fixedDtMillis: number,
  timeScale: number,
  durationMs = 100,
  phaseFocusEntityId?: string,
): PlaybackScript {
  const phase: PlaybackScript["phases"][number] = {
    durationMs,
    controls: { circleNow: true },
  };
  if (phaseFocusEntityId) {
    phase.focusEntityId = phaseFocusEntityId;
  }

  return {
    id: "custom-playback",
    snapshot: {
      metadata: {
        label: "custom-playback",
        capturedSimTimeMillis: 0,
        dominantBodyId: null,
        focusEntityId: "ship:test",
      },
      entities: [],
    },
    fixedDtMillis,
    timeScale,
    phases: [phase],
    endBehavior: "pause",
    metadata: {
      capturedSimTimeMillis: 0,
      recordingStartedRuntimeMs: 0,
      recordingEndedRuntimeMs: 100,
    },
  };
}

function createControlInput(actions: readonly string[]): ExternalControlInput {
  return Object.fromEntries(actions.map((action) => [action, false]));
}
