import type { DiagnosticLogMode } from "../../../app/runtimeOptions";
import type { CompiledPlaybackScript } from "../types";
import { createCircleNowLogger } from "./circleNow";
import type { PlaybackLogger } from "./types";

export function createPlaybackLogger(
  mode: DiagnosticLogMode | undefined,
  script: CompiledPlaybackScript,
): PlaybackLogger | null {
  if (mode === "circle-now") {
    return createCircleNowLogger(script);
  }
  return null;
}

export type { PlaybackLogger } from "./types";
