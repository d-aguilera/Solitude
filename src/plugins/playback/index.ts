import type { GamePlugin } from "../../app/pluginPorts";
import type { RuntimeOptions } from "../../app/runtimeOptions";
import { createPlaybackController } from "./core";
import { createHudPlugin } from "./hud";
import { createInputPlugin } from "./input";

export function createPlaybackPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const controller = createPlaybackController(
    runtimeOptions.diagnostic,
    runtimeOptions.diagnosticWarning,
  );

  return {
    id: "playback",
    controls: {
      updateControlState: ({ controlInput, controlState }) => {
        controller.updateControlState(controlInput, controlState);
      },
    },
    hud: createHudPlugin(controller),
    input: createInputPlugin(runtimeOptions.diagnostic, controller),
    loop: {
      getInitialSimTimeMillis: () => controller.getInitialSimTimeMillis(),
      updateLoopState: ({
        controlInput,
        dtMillis,
        world,
        mainShip,
        nowMs,
        simTimeMillis,
        state,
      }) =>
        controller.updateLoop(
          controlInput,
          world,
          mainShip,
          nowMs,
          simTimeMillis ?? 0,
          getEffectiveTimeScale(dtMillis, state.framePolicy.simDtMillis),
        ),
      afterFrame: () => {
        controller.afterFrame();
      },
    },
    scene: {
      initScene: ({ world }) => {
        controller.applySceneSnapshot(world);
      },
    },
  };
}

function getEffectiveTimeScale(
  dtMillis: number,
  simDtMillis: number | undefined,
): number {
  if (dtMillis <= 0 || simDtMillis == null) return 1;
  return simDtMillis / dtMillis;
}
