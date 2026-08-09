import { describe, expect, it } from "vitest";
import { resolveGravityEngine } from "../../app/gravityProvider";
import type { GamePlugin } from "../../app/pluginPorts";

describe("gravity provider", () => {
  it("requires exactly one provider", () => {
    expect(() => resolveGravityEngine([])).toThrowError(
      "A gravity provider plugin is required",
    );
    expect(() =>
      resolveGravityEngine([
        createGravityPlugin("gravity-a"),
        createGravityPlugin("gravity-b"),
      ]),
    ).toThrowError('Multiple gravity providers: "gravity-a" and "gravity-b"');
  });

  it("creates a fresh engine for each resolution", () => {
    const plugin = createGravityPlugin("gravity");

    expect(resolveGravityEngine([plugin])).not.toBe(
      resolveGravityEngine([plugin]),
    );
  });

  it("rejects an invalid engine", () => {
    const plugin: GamePlugin = {
      id: "invalid-gravity",
      gravity: {
        createGravityEngine: () => null as never,
      },
    };

    expect(() => resolveGravityEngine([plugin])).toThrowError(
      'Gravity provider "invalid-gravity" returned an invalid engine',
    );
  });
});

function createGravityPlugin(id: string): GamePlugin {
  return {
    id,
    gravity: {
      createGravityEngine: () => ({ step: () => {} }),
    },
  };
}
