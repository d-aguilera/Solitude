import { createPlugin as createFeature } from "../ships";
import { selectSandboxPlugin } from "./runSelection";

export const createPlugin = selectSandboxPlugin("ships", createFeature);
