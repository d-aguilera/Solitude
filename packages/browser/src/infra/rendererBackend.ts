import type { RuntimeOptions } from "@solitude/engine/plugin";

export type RendererBackend = "canvas" | "webgl";

export type RenderFailureCode =
  | "webgl-context-lost"
  | "webgl-program-failed"
  | "webgl2-unavailable";

export interface RenderFailure {
  code: RenderFailureCode;
  cause: unknown;
}

export function resolveRendererBackend(
  runtimeOptions: RuntimeOptions,
): RendererBackend {
  return runtimeOptions.renderer === "canvas" ? "canvas" : "webgl";
}
