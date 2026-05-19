import { createControlInput } from "@solitude/engine/app/controlPorts";
import type { LoopUpdateParams } from "@solitude/engine/app/pluginPorts";
import type {
  ControlledBody,
  World,
} from "@solitude/engine/domain/domainPorts";
import { localFrame } from "@solitude/engine/domain/localFrame";
import { mat3 } from "@solitude/engine/domain/mat3";
import { vec3 } from "@solitude/engine/domain/vec3";
import { describe, expect, it, vi } from "vitest";
import { createPlaybackController } from "./core";
import type { PlaybackScript } from "./types";

function createShip(id: string): ControlledBody {
  const ship: ControlledBody = {
    id,
    position: vec3.create(1, 0, 0),
    velocity: vec3.create(0, 1, 0),
    frame: localFrame.fromUp(vec3.create(0, 0, 1)),
    orientation: mat3.zero(),
    angularVelocity: { roll: 0, pitch: 0, yaw: 0 },
  };
  localFrame.intoMat3(ship.orientation, ship.frame);
  return ship;
}

function createWorldAndShip(): { world: World; ship: ControlledBody } {
  const ship = createShip("ship:test");
  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [ship],
    entities: [{ id: ship.id }],
    entityIndex: new Map([[ship.id, { id: ship.id }]]),
    entityStates: [ship],
    gravityMasses: [{ id: ship.id, density: 1, mass: 1, state: ship }],
    lightEmitters: [],
  };
  return { world, ship };
}

function createWorldWithShips(): {
  enemy: ControlledBody;
  main: ControlledBody;
  world: World;
} {
  const main = createShip("ship:main");
  const enemy = createShip("ship:enemy");
  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [main, enemy],
    entities: [{ id: main.id }, { id: enemy.id }],
    entityIndex: new Map([
      [main.id, { id: main.id }],
      [enemy.id, { id: enemy.id }],
    ]),
    entityStates: [main, enemy],
    gravityMasses: [
      { id: main.id, density: 1, mass: 1, state: main },
      { id: enemy.id, density: 1, mass: 1, state: enemy },
    ],
    lightEmitters: [],
  };
  return { enemy, main, world };
}

describe("playback controller", () => {
  it("records and dumps a script in capture mode", () => {
    const { world, ship } = createWorldAndShip();
    const controller = createPlaybackController({
      mode: "capture",
      scenario: "moon-circle",
    });
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
    const { enemy, main, world } = createWorldWithShips();
    const controller = createPlaybackController({
      mode: "capture",
      scenario: "moon-circle",
    });
    const controlInput = createControlInput(["circleNow"]);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    controller.handleCaptureToggle();
    controller.updateLoop(controlInput, world, main, main.id, 100, 5000, 5);
    controller.updateLoop(controlInput, world, enemy, enemy.id, 1100, 6000, 5);
    controller.handleCaptureToggle();
    controller.updateLoop(controlInput, world, enemy, enemy.id, 2100, 7000, 5);

    const dumpedScript = String(
      info.mock.calls.find((call) =>
        String(call[0]).includes("export const playbackScript"),
      )?.[0] ?? "",
    );
    expect(dumpedScript).toContain('"focusEntityId": "ship:main"');
    expect(dumpedScript).toContain('"focusEntityId": "ship:enemy"');

    info.mockRestore();
  });

  it("fails closed when playback script is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const controller = createPlaybackController({
      mode: "playback",
      scenario: "unregistered",
    });
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
    const { enemy, main, world } = createWorldWithShips();
    const script = createPlaybackScript(20, 1, 100, "ship:main");
    const controller = createPlaybackController(
      {
        mode: "playback",
        scenario: script.id,
      },
      undefined,
      () => script,
    );
    const controlInput = createControlInput(["pauseToggle", "circleNow"]);
    const mainFocus = {
      controlledBody: enemy,
      entityId: enemy.id,
    };

    controller.handlePause();
    controller.updateLoop(controlInput, world, enemy, enemy.id, 0, 0);
    controller.beforeVehicleDynamics(world, mainFocus);

    expect(mainFocus.entityId).toBe(main.id);
    expect(mainFocus.controlledBody).toBe(main);

    controller.afterVehicleDynamics(world, mainFocus);

    expect(mainFocus.entityId).toBe(enemy.id);
    expect(mainFocus.controlledBody).toBe(enemy);
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
      undefined,
      () => script,
    );
    const controlInput = createControlInput(["pauseToggle", "circleNow"]);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const params: LoopUpdateParams = {
      controlInput,
      dtMillis: 20,
      mainFocus: {
        controlledBody: ship,
        entityId: ship.id,
      },
      nowMs: 20,
      simTimeMillis: 20,
      state: {
        framePolicy: {
          advanceOverlay: true,
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
