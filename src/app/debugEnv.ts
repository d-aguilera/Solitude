// Lightweight abstraction over any "environment-level" debug controls,
// e.g., a window-global flag. Keeps game.ts decoupled from direct window access.

export function getProfilingEnabledFromEnv(): boolean {
  if (typeof window === "undefined") return false;
  return (window as any).__profilingEnabled__ === true;
}

export function setProfilingEnabledInEnv(value: boolean): void {
  if (typeof window === "undefined") return;
  (window as any).__profilingEnabled__ = value;
}
