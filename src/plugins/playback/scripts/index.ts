import type { PlaybackScenarioId, PlaybackScript } from "../types";
import { playbackScript as moonCircleScript } from "./moonCircle";

const playbackScripts: Record<string, PlaybackScript | null> = {
  "moon-circle": moonCircleScript,
};

export function getPlaybackScript(
  scenario: PlaybackScenarioId,
): PlaybackScript | null {
  return playbackScripts[scenario] ?? null;
}
