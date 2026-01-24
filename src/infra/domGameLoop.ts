import type { ProfilerController, TickCallback } from "../app/appPorts.js";
import type { RenderSurface2D } from "../render/renderPorts.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "../app/debugEnv.js";
import { startGame } from "../app/game.js";
import {
  init as initInput,
  readControlInput,
  readEnvInput,
} from "../app/input.js";
import type { GravityEngine, Profiler } from "../domain/domainPorts.js";
import type { Renderer, RenderParams } from "../render/renderPorts.js";

/**
 * DOM-level game loop bootstrap.
 *
 * Owns requestAnimationFrame, input polling, and env-level profiling toggles.
 */
export function runDomGameLoop(
  renderer: Renderer,
  gravityEngine: GravityEngine,
  profiler: Profiler,
  profilerController: ProfilerController,
  pilotSurface: RenderSurface2D,
  topSurface: RenderSurface2D,
): void {
  const tick: TickCallback = startGame({
    gravityEngine,
    profiler,
    profilerController,
  });

  initInput();

  let lastProfilingToggleDown = false;

  const loop = (nowMs: number) => {
    const controlInput = readControlInput();
    const envInput = readEnvInput();

    // Edge-triggered profiling toggle based on env input and env flag.
    const profilingTogglePressed = envInput.profilingToggle;
    const currentProfiling = getProfilingEnabledFromEnv();
    let profilingEnabled = currentProfiling;

    if (profilingTogglePressed && !lastProfilingToggleDown) {
      profilingEnabled = !currentProfiling;
      setProfilingEnabledInEnv(profilingEnabled);
    }
    lastProfilingToggleDown = profilingTogglePressed;

    const renderData = tick({
      nowMs,
      controlInput,
      envInput,
      profilingEnabled,
    });

    const renderParams: RenderParams = {
      ...renderData,
      input: controlInput,
      pilotSurface,
      topSurface,
    };

    renderer.renderCurrentFrame(renderParams);

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}
