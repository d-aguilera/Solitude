import type {
  ControlInput,
  EnvInput,
  TickOutput,
  ProfilerController,
  TickCallback,
  TickParams,
} from "../app/appPorts.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "../app/debugEnv.js";
import { startGame as createTickHandler } from "../app/game.js";
import type { GravityEngine, Profiler } from "../domain/domainPorts.js";
import type {
  Renderer,
  RenderParams,
  RenderSurface2D,
} from "../render/renderPorts.js";
import { handlePauseToggle } from "./pause.js";

/**
 * DOM-level game loop (depends on requestAnimationFrame).
 */
export function runLoop(
  renderer: Renderer,
  gravityEngine: GravityEngine,
  profiler: Profiler,
  profilerController: ProfilerController,
  pilotSurface: RenderSurface2D,
  topSurface: RenderSurface2D,
  controlInput: ControlInput,
  envInput: EnvInput,
): void {
  const tick: TickCallback = createTickHandler(gravityEngine);

  const loop = (nowMs: number) => {
    const paused = handlePauseToggle(envInput.pauseToggle);
    const profilingEnabled = handleProfilingToggle(envInput.profilingToggle);

    profilerController.setEnabled(profilingEnabled);
    profilerController.setPaused(paused);
    profilerController.check();

    const tickParams: TickParams = {
      nowMs,
      controlInput,
      profiler,
      paused,
    };

    const output: TickOutput = tick(tickParams);

    const renderParams: RenderParams = {
      scene: output.scene,
      mainShip: output.mainShip,
      pilotCamera: output.pilotCamera,
      topCamera: output.topCamera,
      fps: output.fps,
      currentThrustPercent: output.currentThrustPercent,
      pilotCameraLocalOffset: output.pilotCameraLocalOffset,
      speedMps: output.speedMps,
      pilotSurface,
      topSurface,
    };

    renderer.renderCurrentFrame(renderParams);

    profilerController.flush();

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}

let lastProfilingToggleDown = false;

function handleProfilingToggle(profilingTogglePressed: boolean) {
  const currentProfiling = getProfilingEnabledFromEnv();
  let profilingEnabled = currentProfiling;

  if (profilingTogglePressed && !lastProfilingToggleDown) {
    profilingEnabled = !currentProfiling;
    setProfilingEnabledInEnv(profilingEnabled);
  }

  lastProfilingToggleDown = profilingTogglePressed;

  return profilingEnabled;
}
