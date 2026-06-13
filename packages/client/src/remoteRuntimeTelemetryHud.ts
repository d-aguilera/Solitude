import type { GamePlugin } from "@solitude/engine/plugin";
import { formatSimTime } from "@solitude/engine/render";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import type { SolitudeLocalization } from "@solitude/sim/localization";

const fpsHistoryCapacity = 300;

export interface RemoteRuntimeTelemetryHud {
  readonly plugin: GamePlugin;
  updateFps: (dtMillis: number) => void;
}

export function createRemoteRuntimeTelemetryHudPlugin(
  localization: SolitudeLocalization,
): RemoteRuntimeTelemetryHud {
  const { hud } = localization;
  const history = new Array<number>();
  let tail = -1;
  let sum = 0;
  let fps = 0;

  return {
    plugin: {
      id: "remoteRuntimeTelemetryHud",
      capabilities: [
        createHudPanelProvider({
          writeHud: (grid, context) => {
            grid.addLine(
              "center",
              "runtime.time",
              hud.timePrefix.concat(
                formatSimTime(context.simTimeMillis / 1000),
              ),
            );
            grid.addLine(
              "center",
              "runtime.fps",
              hud.fpsPrefix.concat(localization.formatFixed(fps, 1)),
            );
          },
        }),
      ],
    },
    updateFps: (dtMillis) => {
      if (dtMillis <= 0) return;

      if (history.length < fpsHistoryCapacity) {
        tail++;
        history.push(dtMillis);
        sum += dtMillis;
      } else {
        tail = (tail + 1) % fpsHistoryCapacity;
        sum += dtMillis - history[tail];
        history[tail] = dtMillis;
      }

      fps = 1000 / (sum / history.length);
    },
  };
}
