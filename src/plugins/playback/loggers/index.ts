import type { RuntimeOptions } from "../../../app/pluginPorts";
import type { DiagnosticLogMode } from "../options";
import type { CompiledPlaybackScript } from "../types";
import { createCircleNowLogger } from "./circleNow";
import type { PlaybackLogger } from "./types";

export function createPlaybackLogger(
  mode: DiagnosticLogMode | undefined,
  script: CompiledPlaybackScript,
  runtimeOptions: RuntimeOptions = {},
): PlaybackLogger | null {
  if (mode === "circle-now") {
    return createCircleNowLogger(script, runtimeOptions);
  }
  return null;
}

export type { PlaybackLogger } from "./types";
