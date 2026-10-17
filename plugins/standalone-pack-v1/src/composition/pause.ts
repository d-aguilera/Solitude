import { createPlugin as createFeature } from "../pause";
import { selectSandboxPlugin } from "./runSelection";

export const createPlugin = selectSandboxPlugin("pause", createFeature);
