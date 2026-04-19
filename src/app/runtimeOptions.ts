export type DiagnosticMode = "capture" | "playback";
export type DiagnosticScenario = string;

export interface DiagnosticRuntimeOptions {
  mode: DiagnosticMode;
  scenario: DiagnosticScenario;
}

export interface RuntimeOptions {
  diagnostic?: DiagnosticRuntimeOptions;
  diagnosticWarning?: string;
}
