export type DiagnosticMode = "capture" | "playback";
export type DiagnosticLogMode = "circle-now";
export type DiagnosticScenario = string;

export interface DiagnosticRuntimeOptions {
  mode: DiagnosticMode;
  scenario: DiagnosticScenario;
  log?: DiagnosticLogMode;
}

export interface RuntimeOptions {
  diagnostic?: DiagnosticRuntimeOptions;
  diagnosticLogWarning?: string;
  diagnosticWarning?: string;
}
