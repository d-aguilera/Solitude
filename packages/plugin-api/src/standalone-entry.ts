/** Solitude product entry/menu contract, separate from reusable run lifecycle. */
import {
  isStandaloneSession,
  type StandaloneSession,
} from "./standalone-session";

export const standaloneModeOption = "solitudeStandaloneMode";
export type StandaloneMode = "my-first-orbit" | "free-flight";
export interface StandaloneEntrySession extends StandaloneSession {
  readonly mode: StandaloneMode;
  readonly labels: {
    title: string;
    adventure: string;
    freeFlight: string;
    selectionError: string;
    startupError: string;
    menu: string;
    pause: string;
  };
}
export function isStandaloneEntrySession(
  value: unknown,
): value is StandaloneEntrySession {
  if (!isStandaloneSession(value)) return false;
  const candidate = value as StandaloneEntrySession;
  return (
    (candidate.mode === "my-first-orbit" || candidate.mode === "free-flight") &&
    typeof candidate.labels === "object" &&
    candidate.labels !== null
  );
}
