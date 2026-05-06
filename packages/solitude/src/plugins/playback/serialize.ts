import type { PlaybackScript } from "./types";

export function formatPlaybackScriptModule(script: PlaybackScript): string {
  return [
    'import type { PlaybackScript } from "../types";',
    "",
    "export const playbackScript = ".concat(
      JSON.stringify(script, null, 2),
      " satisfies PlaybackScript;",
    ),
    "",
  ].join("\n");
}
