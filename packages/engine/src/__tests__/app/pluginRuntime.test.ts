import { describe, expect, it, vi } from "vitest";
import { createPluginCapabilityRegistry } from "../../app/pluginCapabilities";
import type { GamePlugin, PluginAssemblyContext } from "../../app/pluginPorts";
import { assembleSimulationPlugins } from "../../app/pluginRuntime";

describe("assembly validation", () => {
  it("inspects materialized and inherited hooks plus additional contributors before execution", () => {
    const tick = vi.fn();
    const factory = vi.fn(() => Object.create({ beforeVehicleDynamics: tick }));
    let captured: PluginAssemblyContext | undefined;
    const validator = vi.fn((context: PluginAssemblyContext) => {
      expect(factory).toHaveBeenCalledOnce();
      captured = context;
      throw new Error("unsupported assembly");
    });
    const plugins: GamePlugin[] = [
      { id: "policy", validateAssembly: validator },
      { id: "factory", simulation: factory },
    ];
    const assembly = assembleSimulationPlugins(
      plugins,
      [{ id: "additional", value: 42 }],
      [{ getAttitudeCommand: () => null }],
      [{ afterGravity: tick }],
    );
    expect(() =>
      assembly.createSimulationPlugins(
        createPluginCapabilityRegistry(assembly.capabilityProviders),
      ),
    ).toThrow('Plugin "policy" assembly rejected: unsupported assembly');
    expect(tick).not.toHaveBeenCalled();
    expect(captured?.contributors.map((c) => [c.id, c.hooks])).toEqual([
      ["policy", []],
      ["factory", ["simulation.beforeVehicleDynamics"]],
      [
        "$additional",
        ["controls.getAttitudeCommand", "simulation.afterGravity"],
      ],
    ]);
    expect(captured?.capabilityRegistry.getAll("additional")).toEqual([42]);
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured?.contributors)).toBe(true);
    expect(
      captured?.contributors.every(
        (c) =>
          Object.isFrozen(c) &&
          Object.isFrozen(c.hooks) &&
          Object.isFrozen(c.capabilities),
      ),
    ).toBe(true);
  });
});
