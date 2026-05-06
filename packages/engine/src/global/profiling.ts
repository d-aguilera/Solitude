import { DefaultProfiler } from "./DefaultProfiler";
import type { Profiler, ProfilerController } from "./globalPorts";

const defaultProfiler = new DefaultProfiler();
export const profiler: Profiler = defaultProfiler;
export const profilerController: ProfilerController = defaultProfiler;
