/**
 * In-place sort of the active prefix [0, count) of an array.
 * Uses quicksort with insertion sort for small partitions.
 */
export function sortRangeInPlace<T>(
  array: T[],
  count: number,
  compare: (a: T, b: T) => number,
): void {
  if (count <= 1) return;

  const hi = count - 1;
  const stackLo = stackLoScratch;
  const stackHi = stackHiScratch;
  stackLo.length = 0;
  stackHi.length = 0;
  stackLo.push(0);
  stackHi.push(hi);
  const insertionThreshold = 16;

  while (stackLo.length > 0) {
    const lo = stackLo.pop() as number;
    const hi = stackHi.pop() as number;
    if (hi - lo <= insertionThreshold) continue;

    const pivot = array[(lo + hi) >> 1];
    let i = lo;
    let j = hi;

    while (i <= j) {
      while (compare(array[i], pivot) < 0) i++;
      while (compare(array[j], pivot) > 0) j--;
      if (i <= j) {
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
        i++;
        j--;
      }
    }

    if (lo < j) {
      stackLo.push(lo);
      stackHi.push(j);
    }
    if (i < hi) {
      stackLo.push(i);
      stackHi.push(hi);
    }
  }

  for (let i = 1; i < count; i++) {
    const item = array[i];
    let j = i - 1;
    while (j >= 0 && compare(array[j], item) > 0) {
      array[j + 1] = array[j];
      j--;
    }
    array[j + 1] = item;
  }
}

// Shared stacks to avoid per-call allocations (not reentrant).
const stackLoScratch: number[] = [];
const stackHiScratch: number[] = [];
