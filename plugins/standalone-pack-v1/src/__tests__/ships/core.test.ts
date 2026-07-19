import {
  celestialBodyProviderCapability,
  type ExternalCelestialBodyProvider,
} from "@solitude/plugin-api/celestial-bodies";
import {
  controllableEntityProviderCapability,
  type ExternalControllableEntityProvider,
} from "@solitude/plugin-api/controllable-entities";
import { vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalEntityConfig,
  ExternalWorldModelPlugin,
} from "@solitude/plugin-api/world-model";
import { describe, expect, it, vi } from "vitest";
import { createPlugin } from "../../ships/index";

const earth = {
  id: "planet:earth",
  mass: 5.972e24,
  physicalRadius: 6_371_000,
  position: vec3.zero(),
  velocity: vec3.zero(),
};
const celestialBodies: ExternalCelestialBodyProvider = {
  getCelestialBody: (id) => (id === earth.id ? earth : null),
};
const polyFighter: ExternalControllableEntityProvider = {
  createEntity: ({ id, placement }) => ({
    id,
    components: {
      controllable: { enabled: true },
      state: { ...placement, kind: "direct" },
    },
  }),
  id: "polyFighter",
  mass: 1_000_000,
};

describe("ships plugin", () => {
  it("places both default ships around Earth and focuses blue", () => {
    const entities: ExternalEntityConfig[] = [];
    let focusEntityId = "";
    const worldModel = getWorldModel();

    worldModel.contributeWorldModel(
      {
        addEntities: (added) => entities.push(...added),
        setMainFocusEntityId: (id) => {
          focusEntityId = id;
        },
      },
      {
        capabilityRegistry: {
          getAll: (id) => {
            if (id === celestialBodyProviderCapability) {
              return [celestialBodies];
            }
            if (id === controllableEntityProviderCapability) {
              return [polyFighter];
            }
            return [];
          },
        },
      },
    );

    expect(entities.map(({ id }) => id)).toEqual(["ship:blue", "ship:red"]);
    expect(focusEntityId).toBe("ship:blue");

    const bluePosition = getDirectPosition(entities[0]);
    const redPosition = getDirectPosition(entities[1]);
    expect(vec3.length(bluePosition)).toBeCloseTo(6_471_000);
    expect(vec3.length(redPosition)).toBeCloseTo(6_471_000);
    expect(vec3.dot(bluePosition, redPosition)).toBeLessThan(0);
  });

  it("fails clearly when required content providers are absent", () => {
    const worldModel = getWorldModel();
    const contribute = () =>
      worldModel.contributeWorldModel(
        {
          addEntities: vi.fn(),
          setMainFocusEntityId: vi.fn(),
        },
        { capabilityRegistry: { getAll: () => [] } },
      );

    expect(contribute).toThrow("requires celestialBodyProvider");
  });
});

function getWorldModel(): ExternalWorldModelPlugin {
  const worldModel = createPlugin({}).hooks?.worldModel;
  if (!worldModel) throw new Error("Expected a world model hook");
  return worldModel;
}

function getDirectPosition(entity: ExternalEntityConfig) {
  const state = entity.components.state;
  if (state?.kind !== "direct") {
    throw new Error(`Expected direct entity state: ${entity.id}`);
  }
  return state.position;
}
