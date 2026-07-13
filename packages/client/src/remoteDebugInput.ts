export type RemoteDebugAction =
  | "decreaseSimulationRate"
  | "increaseSimulationRate"
  | "interpolation"
  | "prediction";

export interface RemoteDebugKeyEvent {
  code: string;
  shiftKey: boolean;
}

const remoteDebugKeyMap: Readonly<Record<string, RemoteDebugAction>> = {
  BracketLeft: "decreaseSimulationRate",
  BracketRight: "increaseSimulationRate",
  KeyP: "prediction",
};

export function getRemoteDebugAction(
  event: RemoteDebugKeyEvent,
): RemoteDebugAction | null {
  if (event.code === "KeyI" && event.shiftKey) return "interpolation";
  return remoteDebugKeyMap[event.code] ?? null;
}
