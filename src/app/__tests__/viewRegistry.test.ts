import { describe, expect, it } from "vitest";
import { vec3 } from "../../domain/vec3";
import { createSpacecraftOperatorPlugin } from "../../plugins/spacecraftOperator/index";
import { createPrimaryViewDefinition } from "../cameras";
import type { WorldAndSceneConfig } from "../configPorts";
import type { GamePlugin } from "../pluginPorts";
import { getMainViewCameraOffset } from "../renderConfigPorts";
import {
  buildViewDefinitions,
  createSceneViewStates,
  getRequiredPrimaryViewState,
} from "../viewRegistry";

function createConfig(): WorldAndSceneConfig {
  return {
    entities: [],
    mainFocusEntityId: "ship:main",
    render: {
      mainViewCameraOffset: vec3.create(0, 0, 0),
      mainViewLookState: { azimuth: 0, elevation: 0 },
    },
    thrustLevel: 1,
  };
}

describe("viewRegistry", () => {
  it("requires a plugin-registered primary view", () => {
    const definitions = buildViewDefinitions(createConfig(), []);
    const views = createSceneViewStates(definitions);

    expect(() => getRequiredPrimaryViewState(views)).toThrow(
      "Required primary view not registered",
    );
  });

  it("gets the default primary view from spacecraftOperator", () => {
    const definitions = buildViewDefinitions(createConfig(), [
      createSpacecraftOperatorPlugin(),
    ]);

    expect(definitions.map((definition) => definition.id)).toEqual(["primary"]);
    expect(definitions[0].layout.kind).toBe("primary");
  });

  it("rejects multiple primary views", () => {
    const extraPrimaryPlugin: GamePlugin = {
      id: "extra-primary",
      views: {
        registerViews: (registry, { config }) => {
          registry.addView(
            createPrimaryViewDefinition(getMainViewCameraOffset(config.render)),
          );
        },
      },
    };
    const definitions = buildViewDefinitions(createConfig(), [
      createSpacecraftOperatorPlugin(),
      extraPrimaryPlugin,
    ]);
    const views = createSceneViewStates(definitions);

    expect(() => getRequiredPrimaryViewState(views)).toThrow(
      "Multiple primary views registered",
    );
  });
});
