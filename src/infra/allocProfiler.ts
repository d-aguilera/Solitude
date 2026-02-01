import type { Profiler } from "../domain/domainPorts.js";

let currentProfiler: Profiler | null = null;
let nameStack: string[] = [];

export function setAllocProfiler(profiler: Profiler | null): void {
  currentProfiler = profiler;
}

function getFullName(name: string): string {
  if (nameStack.length === 0) return name;
  return name + ":" + nameStack.join(":");
}

export const alloc = {
  withName<T>(name: string, fn: () => T): T {
    nameStack.push(name);
    const result: T = fn();
    nameStack.pop();
    return result;
  },
  vec3(count = 1): void {
    currentProfiler?.increment("alloc", getFullName("vec3"), count);
  },
  mat3(count = 1): void {
    currentProfiler?.increment("alloc", getFullName("mat3"), count);
  },
  array(count = 1): void {
    currentProfiler?.increment("alloc", getFullName("array"), count);
  },
};
