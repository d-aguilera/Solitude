import { createPlugin as createFeature } from "../playback";
import { selectSandboxPlugin } from "./runSelection";

export const createPlugin = selectSandboxPlugin("playback", createFeature);
