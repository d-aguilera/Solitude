import type {
  ControlInput,
  EnvInput,
  TickOutput,
  TickCallback,
  TickParams,
} from "../app/appPorts.js";
import { startGame as createTickHandler } from "../app/game.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import type {
  Renderer,
  RenderParams,
  RenderSurface2D,
} from "../render/renderPorts.js";
import type { ProfilerController } from "./infraPorts.js";
import { handlePauseToggle } from "./pause.js";
import { handleProfilingToggle } from "./profilerControl.js";

/**
 * DOM-level game loop (depends on requestAnimationFrame).
 */
export function runLoop(
  renderer: Renderer,
  gravityEngine: GravityEngine,
  pilotSurface: RenderSurface2D,
  topSurface: RenderSurface2D,
  controlInput: ControlInput,
  envInput: EnvInput,
  profilerController: ProfilerController,
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
      paused,
    };

    const output: TickOutput = tick(tickParams);

    const renderParams: RenderParams = {
      ...output,
      pilotSurface,
      topSurface,
      profilingEnabled,
    };

    renderer.renderCurrentFrame(renderParams);

    profilerController.flush();

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}
