import type { Profiler } from "./globalPorts";
import { profiler } from "./profiling";

const globalProfiler: Profiler = profiler;

let nameStack: string[] = [];
let nameStackDepth = 0;

function getFullName(name: string): string {
  switch (nameStackDepth) {
    case 0:
      return name;
    case 1:
      return name.concat(":", nameStack[0]);
    case 2:
      return name.concat(":", nameStack[0], ":", nameStack[1]);
    case 3:
      return name.concat(
        ":",
        nameStack[0],
        ":",
        nameStack[1],
        ":",
        nameStack[2],
      );
    default:
      return name.concat(":", nameStack.slice(0, nameStackDepth).join(":"));
  }
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
    globalProfiler.increment("alloc", getFullName("vec3"), count);
  },
  mat3(count = 1): void {
    globalProfiler.increment("alloc", getFullName("mat3"), count);
  },
  array(count = 1): void {
    globalProfiler.increment("alloc", getFullName("array"), count);
  },
};
