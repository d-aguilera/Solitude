/** Owns construction-time resources; teardown releases every resource once. */
export function createDisposalScope(): {
  readonly disposed: boolean;
  add: (dispose: () => void) => void;
  dispose: () => void;
} {
  const disposers: (() => void)[] = [];
  let disposed = false;
  return {
    get disposed() {
      return disposed;
    },
    add: (dispose) => {
      if (disposed) dispose();
      else disposers.push(dispose);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      const errors: unknown[] = [];
      while (disposers.length > 0) {
        try {
          disposers.pop()!();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0)
        throw Object.assign(new Error("Runtime cleanup failed"), { errors });
    },
  };
}
