import { vec3, type Vec3 } from "@solitude/engine/math";
import type {
  GamePlugin,
  PluginCapabilityRegistry,
  RuntimeOptions,
  SceneLabelPlugin,
} from "@solitude/engine/plugin";
import {
  type BodySceneObject,
  type ControlledBodySceneObject,
  type LightEmitterSceneObject,
  type SceneObject,
} from "@solitude/engine/render";
import type { EntityId, World } from "@solitude/engine/world";
import { formatEntityName } from "@solitude/entity-names";
import { readLocaleRuntimeOption } from "@solitude/localization";
import {
  createBodyLabelLocalization,
  type BodyLabelLocalization,
} from "./localization";

const distanceScratch: Vec3 = vec3.zero();

export function createBodyLabelsPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const localization = createBodyLabelLocalization(
    readLocaleRuntimeOption(runtimeOptions),
  );
  return {
    id: "bodyLabels",
    labels: createSceneLabelPlugin(localization),
  };
}

function createSceneLabelPlugin(
  localization: BodyLabelLocalization,
): SceneLabelPlugin {
  const displayNamesById = new Map<string, string>();
  const labelLinesScratch: string[] = [];

  return {
    appendLabels: (into, params) => {
      const referencePosition = params.mainFocus.controlledBody.position;
      for (const object of params.scene.objects) {
        if (!isLabelledObject(object)) {
          continue;
        }
        if (
          object.kind === "controlledBody" &&
          object.id === params.mainFocus.entityId
        ) {
          continue;
        }

        vec3.subInto(distanceScratch, object.position, referencePosition);
        const distance = vec3.length(distanceScratch);
        const velocity = getObjectVelocity(params.world, object);
        writeLabelLines(
          labelLinesScratch,
          params.labelMode,
          getDisplayName(displayNamesById, object, params.capabilityRegistry),
          distance,
          velocity ? vec3.length(velocity) : 0,
          localization,
        );
        into.addLabel(
          object.id,
          object.position,
          labelLinesScratch,
          object.kind === "controlledBody" ? undefined : object.centralEntityId,
          -distance,
        );
      }
    },
  };
}

function writeLabelLines(
  into: string[],
  labelMode: "full" | "nameOnly",
  displayName: string,
  distance: number,
  speed: number,
  localization: BodyLabelLocalization,
): void {
  into[0] = displayName;
  if (labelMode === "nameOnly") {
    into.length = 1;
    return;
  }
  into[1] = localization.distanceLabel(localization.formatDistance(distance));
  into[2] = localization.velocityLabel(localization.formatSpeed(speed));
  into.length = 3;
}

function getDisplayName(
  displayNamesById: Map<string, string>,
  object: SceneObject,
  capabilityRegistry: PluginCapabilityRegistry,
) {
  if (object.displayName) return object.displayName;
  let displayName = displayNamesById.get(object.id);
  if (!displayName) {
    displayName = formatEntityName(capabilityRegistry, object.id, undefined);
    displayNamesById.set(object.id, displayName);
  }
  return displayName;
}

function isLabelledObject(
  object: SceneObject,
): object is
  | BodySceneObject
  | ControlledBodySceneObject
  | LightEmitterSceneObject {
  return (
    object.kind === "controlledBody" ||
    object.kind === "orbitalBody" ||
    object.kind === "lightEmitter"
  );
}

function getObjectVelocity(
  world: World,
  object: BodySceneObject | ControlledBodySceneObject | LightEmitterSceneObject,
): Vec3 | null {
  if (object.kind !== "controlledBody") return object.velocity;
  const body = findControlledBody(world, object.id);
  return body?.velocity ?? null;
}

function findControlledBody(world: World, id: EntityId) {
  for (const body of world.controllableBodies) {
    if (body.id === id) return body;
  }
  return null;
}
