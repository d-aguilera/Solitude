import type { GameDependencies } from "../app/appPorts.js";
import type { TickCallback } from "../app/appPorts.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "../app/debugEnv.js";
import { createApp } from "../app/main.js";
import {
  init as initInput,
  readControlInput,
  readEnvInput,
} from "../app/input.js";

/**
 * DOM-level game loop bootstrap.
 *
 * Owns requestAnimationFrame, input polling, and env-level profiling toggles.
 */
export function runDomGameLoop(deps: GameDependencies): void {
  const tick: TickCallback = createApp(deps);

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

    tick({
      nowMs,
      controlInput,
      envInput,
      profilingEnabled,
    });

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}
