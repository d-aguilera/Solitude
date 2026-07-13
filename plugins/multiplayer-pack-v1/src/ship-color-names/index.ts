import {
  createEntityNameProvider,
  readLocaleRuntimeOption,
  type ExternalPlugin,
  type ExternalRgb,
  type ExternalRuntimeOptions,
} from "@solitude/plugin-api";
import {
  getShipColorNames,
  type ShipColorNameKey,
  type ShipColorNames,
} from "./localization";

const shipColorNameKeyByRgb = new Map<number, ShipColorNameKey>([
  [rgbKey({ r: 64, g: 180, b: 255 }), "blue"],
  [rgbKey({ r: 255, g: 80, b: 80 }), "red"],
  [rgbKey({ r: 255, g: 210, b: 64 }), "gold"],
  [rgbKey({ r: 90, g: 220, b: 125 }), "green"],
  [rgbKey({ r: 190, g: 135, b: 255 }), "violet"],
  [rgbKey({ r: 255, g: 145, b: 60 }), "orange"],
  [rgbKey({ r: 255, g: 105, b: 190 }), "magenta"],
  [rgbKey({ r: 220, g: 240, b: 255 }), "white"],
  [rgbKey({ r: 80, g: 230, b: 215 }), "teal"],
  [rgbKey({ r: 180, g: 235, b: 80 }), "lime"],
  [rgbKey({ r: 120, g: 155, b: 255 }), "indigo"],
  [rgbKey({ r: 255, g: 180, b: 135 }), "coral"],
  [rgbKey({ r: 155, g: 235, b: 255 }), "ice"],
  [rgbKey({ r: 240, g: 150, b: 255 }), "rose"],
  [rgbKey({ r: 210, g: 190, b: 150 }), "stone"],
  [rgbKey({ r: 150, g: 255, b: 170 }), "mint"],
]);

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  return createShipColorNamesPlugin(
    getShipColorNames(readLocaleRuntimeOption(runtimeOptions)),
  );
}

function createShipColorNamesPlugin(names: ShipColorNames): ExternalPlugin {
  const namesByEntityId = new Map<string, string>();

  return {
    id: "shipColorNames",
    capabilities: [
      createEntityNameProvider({
        formatEntityName: (entityId) => namesByEntityId.get(entityId) ?? null,
      }),
    ],
    scene: {
      initScene: ({ config, world }) => {
        namesByEntityId.clear();
        for (const body of world.controllableBodies) {
          const entity = config.entities.find(
            (candidate) => candidate.id === body.id,
          );
          const color = entity?.components.renderable?.color;
          if (!color) continue;
          const nameKey = shipColorNameKeyByRgb.get(rgbKey(color));
          if (nameKey) namesByEntityId.set(body.id, names[nameKey]);
        }
      },
    },
  };
}

function rgbKey(color: ExternalRgb): number {
  return (color.r << 16) | (color.g << 8) | color.b;
}
