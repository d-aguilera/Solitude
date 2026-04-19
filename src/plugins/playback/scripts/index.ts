import { playbackScript as moonCircleScript } from "./moonCircle";
import type { PlaybackScenarioId, PlaybackScript } from "../types";

const playbackScripts: Record<string, PlaybackScript | null> = {
  "moon-circle": moonCircleScript,
};

export function getPlaybackScript(
  scenario: PlaybackScenarioId,
): PlaybackScript | null {
  return playbackScripts[scenario] ?? null;
}
