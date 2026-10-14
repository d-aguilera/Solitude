import { createEntityNameProvider } from "@solitude/plugin-api/entity-names";
import { vec3 } from "@solitude/plugin-api/math";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import {
  createOrbitObservation,
  createOrbitReadout,
  isOrbitReadoutProvider,
  orbitObservationCapability,
} from "@solitude/plugin-api/telemetry";
import { computeStandardGravitationalParameter } from "@solitude/plugin-api/world";
import { describe, expect, it, vi } from "vitest";
import { createPlugin as createObserverPlugin } from "../../orbit-observation/index";
import { createPlugin as createTelemetryPlugin } from "../../orbit-telemetry/index";
import {
  columnTexts,
  createTestHudContext,
  createTestHudGrid,
  createTestWorldAndBody,
  getHudPanel,
} from "../shared/hudTest";

describe("orbit telemetry plugin", () => {
  it("writes orbit and circularization cells", () => {
    const { world, body } = createTestWorldAndBody();
    const panel = getHudPanel(createPlugin({ locale: "en" }));
    const grid = createTestHudGrid();

    panel.writeHud(grid, createTestHudContext(world, body));

    expect(columnTexts(grid, "left")[0]).toBe("Orbit: Earth (bound)");
    expect(columnTexts(grid, "left")[1]).toBe("d: 6771 km");
    expect(columnTexts(grid, "left")[2]).toBe("Altitude: 400 km");
    expect(columnTexts(grid, "left")[3]).toBe("Pe alt: 400 km");
    expect(columnTexts(grid, "left")[4]).toBe("Ap alt: 400 km");
    expect(columnTexts(grid, "left")[5]).toBe("e: 0.000");
    expect(columnTexts(grid, "left")[6]).toBe("i: 0.0°");
    expect(columnTexts(grid, "leftCenter")[0]).toContain("Δv Rad: ");
    expect(columnTexts(grid, "leftCenter")[1]).toContain("Δv Tan: ");
  });

  it("writes escape periapsis and inbound timing", () => {
    const { world, body } = createTestWorldAndBody();
    const planetMass = 5.972e24;
    const eccentricity = 1.5;
    const periapsis = 10_000_000;
    const radius = 25_000_000;
    const semiLatusRectum = periapsis * (1 + eccentricity);
    const mu = computeStandardGravitationalParameter(planetMass);
    const angularMomentum = Math.sqrt(mu * semiLatusRectum);
    const radialSpeed = -((mu / angularMomentum) * eccentricity);
    const tangentialSpeed = angularMomentum / radius;
    const panel = getHudPanel(createPlugin({ locale: "en" }));
    const grid = createTestHudGrid();
    const context = createTestHudContext(world, body);

    body.position = vec3.create(radius, 0, 0);
    body.velocity = vec3.create(radialSpeed, tangentialSpeed, 0);
    panel.writeHud(grid, context);

    expect(columnTexts(grid, "left")[0]).toBe("Orbit: Earth (escape)");
    expect(columnTexts(grid, "left")[1]).toBe("d: 25000 km");
    expect(columnTexts(grid, "left")[2]).toBe("Altitude: 18629 km");
    expect(columnTexts(grid, "left")[3]).toBe("Pe alt: 3629 km");
    expect(columnTexts(grid, "left")[4]).toBe("Ap alt: --");
    expect(columnTexts(grid, "leftCenter")[2]).toMatch(/^Pe in: /);
    expect(columnTexts(grid, "leftCenter")[2]).not.toBe("Pe in: --");
    expect(columnTexts(grid, "leftCenter")[3]).toBe("Ap in: --");

    const outboundGrid = createTestHudGrid();
    body.velocity = vec3.create(-radialSpeed, tangentialSpeed, 0);
    panel.writeHud(outboundGrid, context);

    expect(columnTexts(outboundGrid, "left")[4]).toBe("Ap alt: --");
    expect(columnTexts(outboundGrid, "leftCenter")[2]).toBe("Pe in: --");
    expect(columnTexts(outboundGrid, "leftCenter")[3]).toBe("Ap in: --");
  });

  it("keeps delta-v direction labels stable inside the deadband", () => {
    const { world, body } = createTestWorldAndBody();
    const orbitRadius = vec3.length(body.position);
    const circularSpeed = Math.sqrt(
      computeStandardGravitationalParameter(5.972e24) / orbitRadius,
    );
    const panel = getHudPanel(createPlugin({ locale: "en" }));
    const grid = createTestHudGrid();
    const context = createTestHudContext(world, body);

    body.velocity = vec3.create(-1, circularSpeed - 1, 0);
    panel.writeHud(grid, context);
    expect(columnTexts(grid, "leftCenter")[0]).toContain(" out");
    expect(columnTexts(grid, "leftCenter")[1]).toContain(" pro");

    body.velocity = vec3.create(0.000001, circularSpeed + 0.000001, 0);
    panel.writeHud(grid, context);
    expect(columnTexts(grid, "leftCenter")[0]).toContain(" out");
    expect(columnTexts(grid, "leftCenter")[1]).toContain(" pro");

    body.velocity = vec3.create(0.02, circularSpeed + 0.02, 0);
    panel.writeHud(grid, context);
    expect(columnTexts(grid, "leftCenter")[0]).toContain(" in");
    expect(columnTexts(grid, "leftCenter")[1]).toContain(" retro");
  });

  it("localizes primary body names", () => {
    const { world, body } = createTestWorldAndBody();
    const panel = getHudPanel(createPlugin({ locale: "es" }));
    const grid = createTestHudGrid();
    const context = createTestHudContext(world, body, [
      createEntityNameProvider({
        formatEntityName: (entityId) =>
          entityId === "planet:earth" ? "Tierra" : null,
      }),
    ]);

    panel.writeHud(grid, context);

    expect(columnTexts(grid, "left")[0]).toBe("Órbita: Tierra (ligada)");
    expect(columnTexts(grid, "left")[1]).toBe("d: 6771 km");
    expect(columnTexts(grid, "left")[5]).toBe("e: 0,000");
    expect(columnTexts(grid, "left")[6]).toBe("i: 0,0°");
  });

  it("writes empty orbit cells when no primary is available", () => {
    const { world, body } = createTestWorldAndBody();
    world.collisionSpheres.length = 0;
    world.gravityMasses.length = 0;
    const panel = getHudPanel(createPlugin({ locale: "en" }));
    const grid = createTestHudGrid();

    panel.writeHud(grid, createTestHudContext(world, body));

    expect(columnTexts(grid, "left")).toEqual([
      "Orbit: --",
      "d: --",
      "Altitude: --",
    ]);
    expect(columnTexts(grid, "leftCenter")).toEqual([]);
  });
});

it("keeps negative predicted altitude and recomputes altitude for the current primary radius", () => {
  const { world, body } = createTestWorldAndBody();
  const panel = getHudPanel(createPlugin({ locale: "en" }));
  const context = createTestHudContext(world, body);
  const mu = computeStandardGravitationalParameter(5.972e24);
  const apoapsis = 6771000;
  const periapsis = 6321000;
  body.velocity = vec3.create(
    0,
    Math.sqrt(mu * (2 / apoapsis - 2 / (apoapsis + periapsis))),
    0,
  );
  const grid = createTestHudGrid();
  panel.writeHud(grid, context);
  expect(
    grid.columns.left.find((line) => line.key === "orbit.periapsisAltitude")
      ?.text,
  ).toBe("Pe alt: -50 km");
  // A different dominant body's surface must replace the previous radius.
  const primary = world.gravityMasses[1];
  primary.id = "planet:other";
  world.collisionSpheres[0].id = primary.id;
  world.collisionSpheres[0].radius = 6000000;
  panel.writeHud(grid, context);
  expect(
    grid.columns.left.find((line) => line.key === "orbit.altitude")?.text,
  ).toBe("Altitude: 771 km");
  world.collisionSpheres[0].radius = NaN;
  panel.writeHud(grid, context);
  expect(
    grid.columns.left.find((line) => line.key === "orbit.altitude")?.text,
  ).toBe("Altitude: --");
});

function createPlugin(options: ExternalRuntimeOptions) {
  const plugin = createTelemetryPlugin(options);
  const capabilities = createObserverPlugin(options).capabilities!;
  plugin.validateAssembly!({
    contributors: [],
    capabilityRegistry: {
      getAll: (id) =>
        capabilities.filter((c) => c.id === id).map((c) => c.value),
    },
  });
  return plugin;
}

it("uses the independently composed observation service and binds only during assembly", () => {
  const { world, body } = createTestWorldAndBody();
  const providerPlugin = createObserverPlugin({});
  const service = providerPlugin.capabilities![0].value;
  expect(isOrbitReadoutProvider(service)).toBe(true);
  if (!isOrbitReadoutProvider(service)) throw new Error("Missing service");
  const readout = vi.spyOn(service, "readoutInto");
  const getAll = vi.fn((id: string) =>
    id === orbitObservationCapability ? [service] : [],
  );
  const hud = createTelemetryPlugin({});
  expect(
    hud.capabilities!.some((c) => c.id === orbitObservationCapability),
  ).toBe(false);
  expect(providerPlugin.capabilities!.length).toBe(1);
  hud.validateAssembly!({ contributors: [], capabilityRegistry: { getAll } });
  const panel = getHudPanel(hud);
  const context = createTestHudContext(world, body);
  const grid = createTestHudGrid();
  const observation = createOrbitObservation();
  service.sampleInto(observation, world, body.id);
  panel.writeHud(grid, context);
  const retained = readout.mock.calls[0][0];
  expect(retained.altitudeMeters).toBe(observation.altitudeMeters);
  body.velocity.y *= 0.95;
  service.sampleInto(observation, world, body.id);
  panel.writeHud(grid, context);
  expect(readout.mock.calls[1][0]).toBe(retained);
  expect(retained.periapsis - retained.primaryRadius).toBe(
    observation.periapsisAltitudeMeters,
  );
  expect(getAll).toHaveBeenCalledTimes(1);
  const missing = createOrbitReadout();
  expect(service.readoutInto(missing, world, "absent")).toBe(false);
  expect(missing.altitudeMeters).toBeNull();
});

it.each([
  { values: [] },
  { values: [{ sampleInto: () => {} }] },
  { values: ["duplicate"] },
])(
  "rejects unavailable or ambiguous instrument services at assembly",
  ({ values }) => {
    const service = createObserverPlugin({}).capabilities![0].value;
    const providers = values[0] === "duplicate" ? [service, service] : values;
    const hud = createTelemetryPlugin({});
    expect(() =>
      hud.validateAssembly!({
        contributors: [],
        capabilityRegistry: { getAll: () => providers },
      }),
    ).toThrow("Orbit telemetry requires one orbital readout provider");
  },
);

it("binds the shared observer once in a presentation-only remote host", () => {
  const { world, body } = createTestWorldAndBody();
  const service = createObserverPlugin({}).capabilities![0].value;
  const context = createTestHudContext(world, body);
  const getAll = vi.fn((id: string) =>
    id === orbitObservationCapability ? [service] : [],
  );
  context.capabilityRegistry.getAll = getAll;
  const panel = getHudPanel(createTelemetryPlugin({}));
  const grid = createTestHudGrid();
  panel.writeHud(grid, context);
  panel.writeHud(grid, context);
  expect(columnTexts(grid, "left")[0]).toBe("Orbit: Earth (bound)");
  expect(
    getAll.mock.calls.filter(([id]) => id === orbitObservationCapability),
  ).toHaveLength(1);
});
