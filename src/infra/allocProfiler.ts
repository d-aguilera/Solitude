import type { Profiler } from "../domain/domainPorts.js";

let currentProfiler: Profiler | null = null;
let nameStack: string[] = [];
let nameStackDepth = 0;

export function setAllocProfiler(profiler: Profiler | null): void {
  currentProfiler = profiler;
}

function getFullName(name: string): string {
  if (nameStackDepth === 0) return name;
  return name + ":" + nameStack.slice(0, nameStackDepth).join(":");
}

export const alloc = {
  withName<T>(name: string, fn: () => T): T {
    if (nameStack.length === nameStackDepth) {
      nameStack.push(name);
    } else {
      nameStack[nameStackDepth] = name;
    }
    nameStackDepth++;

    const result: T = fn();

    nameStackDepth--;

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
