import { createHudPanelCapability } from "@solitude/plugin-api/hud";
import { createKeyboardInputCapability } from "@solitude/plugin-api/input";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type {
  ExternalPlugin,
  ExternalPluginContext,
} from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { createPlaybackController } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";
import { createPlaybackLocalization } from "./localization";
import { parsePlaybackRuntimeOptions } from "./options";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
  { snapshots }: ExternalPluginContext,
): ExternalPlugin {
  const options = parsePlaybackRuntimeOptions(runtimeOptions);
  const localization = createPlaybackLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  const controller = createPlaybackController(
    options.diagnostic,
    snapshots,
    options.diagnosticWarning ?? undefined,
    undefined,
  );
  if (options.diagnosticLogWarning) {
    console.warn(options.diagnosticLogWarning);
  }

  return {
    id: "playback",
    capabilities: [
      createHudPanelCapability(createHudPanel(controller, localization)),
      createKeyboardInputCapability(
        createInputPlugin(options.diagnostic, controller),
      ),
    ],
    hooks: {
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
        beforeVehicleDynamics: (params) => {
          controller.beforeVehicleDynamics(params);
        },
        afterVehicleDynamics: (params) => {
          controller.afterVehicleDynamics(params);
        },
      },
      scene: {
        initScene: ({ world }) => {
          controller.applySceneSnapshot(world);
        },
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
