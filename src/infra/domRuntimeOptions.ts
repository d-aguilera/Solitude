import type { DiagnosticMode, RuntimeOptions } from "../app/runtimeOptions";

const diagnosticModes: readonly DiagnosticMode[] = ["capture", "playback"];

export function parseRuntimeOptionsFromSearch(search: string): RuntimeOptions {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  const scenario = params.get("scenario");

  if (!mode && !scenario) return {};

  if (!isDiagnosticMode(mode)) {
    return {
      diagnosticWarning: "Invalid diagnostic mode; expected capture/playback.",
    };
  }

  if (!isDiagnosticScenario(scenario)) {
    return {
      diagnosticWarning: "Invalid diagnostic scenario; expected a value.",
    };
  }

  return {
    diagnostic: { mode, scenario },
  };
}

function isDiagnosticMode(value: string | null): value is DiagnosticMode {
  return diagnosticModes.includes(value as DiagnosticMode);
}

function isDiagnosticScenario(value: string | null): value is string {
  return value != null && value.length > 0;
}
