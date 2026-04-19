import type { PlaybackScenarioId, PlaybackScript } from "../types";
import { playbackScript as moonCircleLongScript } from "./moonCircleLong";
import { playbackScript as moonCircleOKScript } from "./moonCircleOK";

const playbackScripts: Record<string, PlaybackScript | null> = {
  "moon-circle-long": moonCircleLongScript,
  "moon-circle-ok": moonCircleOKScript,
};

export function getPlaybackScript(
  scenario: PlaybackScenarioId,
): PlaybackScript | null {
  return playbackScripts[scenario] ?? null;
}
