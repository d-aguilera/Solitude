import type { HudPanelProvider } from "../hud/capabilities";
import type { PauseController } from "./logic";

const pausedText = "PAUSED";

export function createHudPlugin(controller: PauseController): HudPanelProvider {
  return createHudPanel(controller);
}

export function createHudPanel(controller: PauseController): HudPanelProvider {
  return {
    writeHud: (grid) => {
      if (!controller.isPaused()) return;
      grid[2][1] = pausedText;
    },
  };
}
