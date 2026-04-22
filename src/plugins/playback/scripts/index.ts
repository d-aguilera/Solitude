import type { PlaybackScenarioId, PlaybackScript } from "../types";
import { playbackScript as moonCircleLongScript } from "./moonCircleLong";
import { playbackScript as moonCircleLong2Script } from "./moonCircleLong_2";
import { playbackScript as moonCircleOKScript } from "./moonCircleOK";
import { playbackScript as moonCircleOK2Script } from "./moonCircleOK_2";

const playbackScripts: Record<string, PlaybackScript | null> = {
  "moon-circle-long": moonCircleLongScript,
  "moon-circle-ok": moonCircleOKScript,
  "moon-circle-long-2": moonCircleLong2Script,
  "moon-circle-ok-2": moonCircleOK2Script,
};

export function getPlaybackScript(
  scenario: PlaybackScenarioId,
): PlaybackScript | null {
  return playbackScripts[scenario] ?? null;
}
