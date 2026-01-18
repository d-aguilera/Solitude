import type { GameDependencies } from "../app/game.js";
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

/**
 * DOM-level game loop bootstrap.
 */
export function runDomGameLoop(deps: GameDependencies): void {
  const tick = startGame(deps);

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
