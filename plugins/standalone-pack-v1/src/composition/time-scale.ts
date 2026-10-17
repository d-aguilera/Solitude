import { createPlugin as createFeature } from "../time-scale";
import { selectSandboxPlugin } from "./runSelection";

export const createPlugin = selectSandboxPlugin("timeScale", createFeature);
