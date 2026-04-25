import type { PlaybackScenarioId, PlaybackScript } from "../types";

const playbackScripts: Record<string, PlaybackScript | null> = {};

export function getPlaybackScript(
  scenario: PlaybackScenarioId,
): PlaybackScript | null {
  return playbackScripts[scenario] ?? null;
}
