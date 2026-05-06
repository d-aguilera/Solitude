import { createSpacecraftOperatorPlugin } from "solitude/plugins/spacecraftOperator/index";
import { describe, expect, it } from "vitest";
import { localFrame } from "../../domain/localFrame";
import { vec3 } from "../../domain/vec3";
import type { WorldAndSceneConfig } from "../configPorts";
import type { GamePlugin } from "../pluginPorts";
import {
  buildViewDefinitions,
  createSceneViewStates,
  getRequiredPrimaryViewState,
} from "../viewRegistry";

function createConfig(): WorldAndSceneConfig {
  return {
    entities: [],
    mainFocusEntityId: "craft:main",
    render: {
      mainViewCameraOffset: vec3.create(0, 0, 0),
      mainViewLookState: { azimuth: 0, elevation: 0 },
    },
  };
}

describe("viewRegistry", () => {
  it("requires an explicit or registered main view camera rig", () => {
    expect(() => buildViewDefinitions(createConfig(), [])).toThrow(
      "No active main view camera rig configured",
    );
  });

  it("creates the primary view from the first registered rig by default", () => {
    const definitions = buildViewDefinitions(createConfig(), [
      createSpacecraftOperatorPlugin(),
    ]);

    expect(definitions.map((definition) => definition.id)).toEqual(["primary"]);
    expect(definitions[0].layout.kind).toBe("primary");
  });

  it("rejects duplicate active main view camera rigs", () => {
    const duplicateRigPlugin: GamePlugin = {
      id: "duplicate-rig",
      views: {
        registerViews: (registry) => {
          registry.addMainViewCameraRig({
            id: "spacecraft.forward",
            updateFrame: ({ frame }) => {
              localFrame.copyInto(frame, localFrame.zero());
            },
          });
        },
      },
    };

    expect(() =>
      buildViewDefinitions(createConfig(), [
        createSpacecraftOperatorPlugin(),
        duplicateRigPlugin,
      ]),
    ).toThrow("Duplicate main view camera rig registered: spacecraft.forward");
  });

  it("rejects multiple primary views", () => {
    const extraPrimaryPlugin: GamePlugin = {
      id: "extra-primary",
      views: {
        registerViews: (registry) => {
          registry.addView({
            id: "extra-primary",
            initialCameraOffset: vec3.zero(),
            labelMode: "full",
            layout: { kind: "primary" },
            updateFrame: () => {},
          });
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
