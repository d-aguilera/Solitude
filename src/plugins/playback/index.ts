import type { GamePlugin, RuntimeOptions } from "../../app/pluginPorts";
import { createPlaybackController } from "./core";
import { createHudPlugin } from "./hud";
import { createInputPlugin } from "./input";
import { parsePlaybackRuntimeOptions } from "./options";

export function createPlaybackPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const options = parsePlaybackRuntimeOptions(runtimeOptions);
  const controller = createPlaybackController(
    options.diagnostic,
    options.diagnosticWarning ?? undefined,
    undefined,
  );
  if (options.diagnosticLogWarning) {
    console.warn(options.diagnosticLogWarning);
  }

  return {
    id: "playback",
    controls: {
      updateControlState: ({ controlInput, controlState }) => {
        controller.updateControlState(controlInput, controlState);
      },
    },
    hud: createHudPlugin(controller),
    input: createInputPlugin(options.diagnostic, controller),
    loop: {
      getInitialSimTimeMillis: () => controller.getInitialSimTimeMillis(),
      updateLoopState: ({
        controlInput,
        dtMillis,
        world,
        mainControlledBody,
        nowMs,
        simTimeMillis,
        state,
      }) =>
        controller.updateLoop(
          controlInput,
          world,
          mainControlledBody,
          nowMs,
          simTimeMillis ?? 0,
          getEffectiveTimeScale(dtMillis, state.framePolicy.simDtMillis),
        ),
      afterFrame: (params) => {
        controller.afterFrame(params);
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
