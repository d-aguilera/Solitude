import type { PlaybackScenarioId, PlaybackScript } from "../types";
import { playbackScript as raceToTheMoonScript } from "./raceToTheMoon";
import { playbackScript as randomTripScript } from "./randomTrip";

const playbackScripts: Record<string, PlaybackScript | null> = {
  "race-to-the-moon": raceToTheMoonScript,
  "random-trip": randomTripScript,
};

export function getPlaybackScript(
  scenario: PlaybackScenarioId,
): PlaybackScript | null {
  return playbackScripts[scenario] ?? null;
}
