import type { PlaybackScenarioId, PlaybackScript } from "../types";
import { playbackScript as randomTripScript } from "./randomTrip";

const playbackScripts: Record<string, PlaybackScript | null> = {
  "random-trip": randomTripScript,
};

export function getPlaybackScript(
  scenario: PlaybackScenarioId,
): PlaybackScript | null {
  return playbackScripts[scenario] ?? null;
}
