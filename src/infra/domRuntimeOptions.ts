import type { RuntimeOptions } from "../app/pluginPorts";

export function parseRuntimeOptionsFromSearch(search: string): RuntimeOptions {
  const params = new URLSearchParams(search);
  const options: Record<string, string> = {};
  for (const [key, value] of params) {
    options[key] = value;
  }
  return options;
}
