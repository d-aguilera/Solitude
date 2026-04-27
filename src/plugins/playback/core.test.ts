import { describe, expect, it, vi } from "vitest";
import { createControlInput } from "../../app/controlPorts";
import type { LoopUpdateParams } from "../../app/pluginPorts";
import type { ShipBody, World } from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import { createPlaybackController } from "./core";
import type { PlaybackScript } from "./types";

function createWorldAndShip(): { world: World; ship: ShipBody } {
  const ship: ShipBody = {
    id: "ship:test",
    position: vec3.create(1, 0, 0),
    velocity: vec3.create(0, 1, 0),
    frame: localFrame.fromUp(vec3.create(0, 0, 1)),
    orientation: mat3.zero(),
    angularVelocity: { roll: 0, pitch: 0, yaw: 0 },
  };
  localFrame.intoMat3(ship.orientation, ship.frame);

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
      100,
      5000,
      5,
    );
    controlInput.circleNow = true;
    controller.updateLoop(controlInput, world, ship, 1100, 6000, 5);
    controller.handleCaptureToggle();
    controller.updateLoop(controlInput, world, ship, 2100, 7000, 5);

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
      0,
      0,
    );

    expect(controller.getStatus()).toBe("missing");
    expect(result?.framePolicy?.advanceSim).toBe(false);

    controller.handlePause();
    controller.updateLoop(controlInput, undefined, undefined, 16, 0);

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
      mainControlledBody: ship,
      nowMs: 20,
      simTimeMillis: 20,
      state: {
        framePolicy: {
          advanceHud: true,
          advanceScene: true,
          advanceSim: true,
          simDtMillis: 20,
          tickDtMillis: 20,
        },
      },
      world,
    };

    controller.handlePause();
    controller.updateLoop(controlInput, world, ship, 0, 0);
    controller.afterFrame(params);
    controller.updateLoop(controlInput, world, ship, 20, 20);
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
): PlaybackScript {
  return {
    id: "custom-playback",
    snapshot: {
      metadata: {
        label: "custom-playback",
        capturedSimTimeMillis: 0,
        dominantBodyId: null,
      },
      ships: [],
      planets: [],
      stars: [],
    },
    fixedDtMillis,
    timeScale,
    phases: [{ durationMs, controls: { circleNow: true } }],
    endBehavior: "pause",
    metadata: {
      capturedSimTimeMillis: 0,
      recordingStartedRuntimeMs: 0,
      recordingEndedRuntimeMs: 100,
    },
  };
}
