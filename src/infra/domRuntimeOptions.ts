import type {
  DiagnosticLogMode,
  DiagnosticMode,
  DiagnosticRuntimeOptions,
  RuntimeOptions,
} from "../app/runtimeOptions";

const diagnosticModes: readonly DiagnosticMode[] = ["capture", "playback"];
const diagnosticLogModes: readonly DiagnosticLogMode[] = ["circle-now"];

export function parseRuntimeOptionsFromSearch(search: string): RuntimeOptions {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  const scenario = params.get("scenario");
  const log = params.get("log");

  if (!mode && !scenario && !log) return {};

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

  const diagnostic: DiagnosticRuntimeOptions = { mode, scenario };
  const options: RuntimeOptions = { diagnostic };

  if (log) {
    if (isDiagnosticLogMode(log)) {
      diagnostic.log = log;
    } else {
      options.diagnosticLogWarning =
        "Invalid diagnostic log; expected circle-now.";
    }
  }

  return options;
}

function isDiagnosticMode(value: string | null): value is DiagnosticMode {
  return diagnosticModes.includes(value as DiagnosticMode);
}

function isDiagnosticScenario(value: string | null): value is string {
  return value != null && value.length > 0;
}

function isDiagnosticLogMode(value: string | null): value is DiagnosticLogMode {
  return diagnosticLogModes.includes(value as DiagnosticLogMode);
}
