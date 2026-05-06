import type { RuntimeOptions } from "@solitude/engine/app/pluginPorts";

export type DiagnosticMode = "capture" | "playback";
export type DiagnosticLogMode = "circle-now";
export type DiagnosticScenario = string;

export interface DiagnosticRuntimeOptions {
  mode: DiagnosticMode;
  scenario: DiagnosticScenario;
  log?: DiagnosticLogMode;
}

export interface PlaybackRuntimeOptions {
  diagnostic?: DiagnosticRuntimeOptions;
  diagnosticLogWarning: string | null;
  diagnosticWarning: string | null;
}

const diagnosticModes: readonly DiagnosticMode[] = ["capture", "playback"];
const diagnosticLogModes: readonly DiagnosticLogMode[] = ["circle-now"];

export function parsePlaybackRuntimeOptions(
  runtimeOptions: RuntimeOptions,
): PlaybackRuntimeOptions {
  const mode = runtimeOptions.mode;
  const scenario = runtimeOptions.scenario;
  const log = runtimeOptions.log;

  if (!mode && !scenario && !log) {
    return {
      diagnosticLogWarning: null,
      diagnosticWarning: null,
    };
  }

  if (!isDiagnosticMode(mode)) {
    return {
      diagnosticLogWarning: null,
      diagnosticWarning: "Invalid diagnostic mode; expected capture/playback.",
    };
  }

  if (!isDiagnosticScenario(scenario)) {
    return {
      diagnosticLogWarning: null,
      diagnosticWarning: "Invalid diagnostic scenario; expected a value.",
    };
  }

  const diagnostic: DiagnosticRuntimeOptions = { mode, scenario };
  let diagnosticLogWarning: string | null = null;
  if (log) {
    if (isDiagnosticLogMode(log)) {
      diagnostic.log = log;
    } else {
      diagnosticLogWarning = "Invalid diagnostic log; expected circle-now.";
    }
  }

  return {
    diagnostic,
    diagnosticLogWarning,
    diagnosticWarning: null,
  };
}

function isDiagnosticMode(value: string | undefined): value is DiagnosticMode {
  return diagnosticModes.includes(value as DiagnosticMode);
}

function isDiagnosticScenario(
  value: string | undefined,
): value is DiagnosticScenario {
  return value != null && value.length > 0;
}

function isDiagnosticLogMode(
  value: string | undefined,
): value is DiagnosticLogMode {
  return diagnosticLogModes.includes(value as DiagnosticLogMode);
}
