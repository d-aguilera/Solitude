import type {
  ControlInput,
  EnvInput,
  GameOutput,
  ProfilerController,
  TickCallback,
} from "../app/appPorts.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "../app/debugEnv.js";
import { startGame } from "../app/game.js";
import type { GravityEngine, Profiler } from "../domain/domainPorts.js";
import type {
  Renderer,
  RenderParams,
  RenderSurface2D,
} from "../render/renderPorts.js";

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
  const tick: TickCallback = startGame(
    gravityEngine,
    profiler,
    profilerController,
  );

  const loop = (nowMs: number) => {
    let profilingEnabled = handleProfilingToggle(envInput.profilingToggle);

    const output: GameOutput = tick({
      nowMs,
      controlInput,
      envInput,
      profilingEnabled,
    });

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
