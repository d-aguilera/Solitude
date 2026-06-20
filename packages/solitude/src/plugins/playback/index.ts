import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/hud/provider";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { readLocaleRuntimeOption } from "@solitude/sim/localization";
import { createPlaybackController } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";
import { createPlaybackLocalization } from "./localization";
import { parsePlaybackRuntimeOptions } from "./options";

export function createPlaybackPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const options = parsePlaybackRuntimeOptions(runtimeOptions);
  const localization = createPlaybackLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
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
    capabilities: [
      createHudPanelProvider(createHudPanel(controller, localization)),
      createKeyboardInputProvider(
        createInputPlugin(options.diagnostic, controller),
      ),
    ],
    controls: {
      updateControlState: ({ controlInput, controlState }) => {
        controller.updateControlState(controlInput, controlState);
      },
    },
    loop: {
      getInitialSimTimeMillis: () => controller.getInitialSimTimeMillis(),
      updateLoopState: ({
        controlInput,
        dtMillis,
        mainFocus,
        world,
        nowMs,
        simTimeMillis,
        state,
      }) =>
        controller.updateLoop(
          controlInput,
          world,
          mainFocus.controlledBody,
          mainFocus.entityId,
          nowMs,
          simTimeMillis ?? 0,
          getEffectiveTimeScale(dtMillis, state.framePolicy.simDtMillis),
        ),
      afterFrame: (params) => {
        controller.afterFrame(params);
      },
    },
    simulation: {
      beforeVehicleDynamics: ({ mainFocus, world }) => {
        controller.beforeVehicleDynamics(world, mainFocus);
      },
      afterVehicleDynamics: ({ mainFocus, world }) => {
        controller.afterVehicleDynamics(world, mainFocus);
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
