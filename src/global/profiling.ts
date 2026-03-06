import type { ProfilerController } from "../infra/infraPorts.js";
import { DefaultProfiler } from "./DefaultProfiler.js";
import type { Profiler } from "./globalPorts.js";

const defaultProfiler = new DefaultProfiler();
export const profiler: Profiler = defaultProfiler;
export const profilerController: ProfilerController = defaultProfiler;
