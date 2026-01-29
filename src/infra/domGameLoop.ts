import type {
  ControlInput,
  EnvInput,
  GameState,
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

    const renderData: GameState = tick({
      nowMs,
      controlInput,
      envInput,
      profilingEnabled,
    });

    const renderParams: RenderParams = {
      controlState: renderData.controlState,
      scene: renderData.scene,
      mainShip: renderData.mainShip,
      pilotCamera: renderData.pilotCamera,
      topCamera: renderData.topCamera,
      fps: renderData.fps,
      currentThrustPercent: renderData.currentThrustPercent,
      pilotCameraLocalOffset: renderData.pilotCameraLocalOffset,
      speedMps: renderData.speedMps,
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
