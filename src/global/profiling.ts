import type { ProfilerController } from "../infra/infraPorts";
import { DefaultProfiler } from "./DefaultProfiler";
import type { Profiler } from "./globalPorts";

const defaultProfiler = new DefaultProfiler();
export const profiler: Profiler = defaultProfiler;
export const profilerController: ProfilerController = defaultProfiler;
