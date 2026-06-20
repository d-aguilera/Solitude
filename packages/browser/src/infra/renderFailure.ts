export type RenderFailureCode =
  | "webgl-context-lost"
  | "webgl-program-failed"
  | "webgl2-unavailable";

export interface RenderFailure {
  code: RenderFailureCode;
  cause: unknown;
}
