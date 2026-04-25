import type { RuntimeOptions } from "../../app/pluginPorts";
import {
  defaultAutopilotAlgorithmVersion,
  type AutopilotAlgorithmVersion,
} from "./version";

const autopilotAlgorithmVersions: readonly AutopilotAlgorithmVersion[] = [
  "v1",
  "v2",
  "v3",
  "v4",
  "v5",
];

export interface AutopilotRuntimeOptions {
  algorithmVersion: AutopilotAlgorithmVersion;
  warning: string | null;
}

export function parseAutopilotRuntimeOptions(
  runtimeOptions: RuntimeOptions,
): AutopilotRuntimeOptions {
  const value = runtimeOptions.autopilot;
  if (value == null || value.length === 0) {
    return {
      algorithmVersion: defaultAutopilotAlgorithmVersion,
      warning: null,
    };
  }

  if (isAutopilotAlgorithmVersion(value)) {
    return {
      algorithmVersion: value,
      warning: null,
    };
  }

  return {
    algorithmVersion: defaultAutopilotAlgorithmVersion,
    warning: "Invalid autopilot; expected v1/v2/v3/v4/v5.",
  };
}

function isAutopilotAlgorithmVersion(
  value: string,
): value is AutopilotAlgorithmVersion {
  return autopilotAlgorithmVersions.includes(
    value as AutopilotAlgorithmVersion,
  );
}
