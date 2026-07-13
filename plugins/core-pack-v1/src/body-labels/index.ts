import { formatEntityName } from "@solitude/plugin-api/capabilities";
import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type { Vec3 } from "@solitude/plugin-api/math";
import { vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalEntityId,
  ExternalPlugin,
  ExternalPluginCapabilityRegistry,
  ExternalRuntimeOptions,
  ExternalSceneLabelPlugin,
  ExternalSceneObject,
  ExternalWorld,
} from "@solitude/plugin-api/plugin";
import {
  createBodyLabelLocalization,
  type BodyLabelLocalization,
} from "./localization";

const distanceScratch: Vec3 = vec3.zero();

type LabelledSceneObject = ExternalSceneObject & {
  kind: "controlledBody" | "lightEmitter" | "orbitalBody";
  position: Vec3;
};

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
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
): ExternalSceneLabelPlugin {
  const displayNamesById = new Map<string, string>();
  const labelLinesScratch: string[] = [];

  return {
    appendLabels: (into, params) => {
      const referencePosition = params.mainFocus.controlledBody.position;
      for (const object of params.scene.objects) {
        if (!isLabelledObject(object)) continue;
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
  object: LabelledSceneObject,
  capabilityRegistry: ExternalPluginCapabilityRegistry,
): string {
  if (object.displayName) return object.displayName;
  let displayName = displayNamesById.get(object.id);
  if (!displayName) {
    displayName = formatEntityName(capabilityRegistry, object.id, undefined);
    displayNamesById.set(object.id, displayName);
  }
  return displayName;
}

function isLabelledObject(
  object: ExternalSceneObject,
): object is LabelledSceneObject {
  return (
    object.position !== undefined &&
    (object.kind === "controlledBody" ||
      object.kind === "orbitalBody" ||
      object.kind === "lightEmitter")
  );
}

function getObjectVelocity(
  world: ExternalWorld,
  object: LabelledSceneObject,
): Vec3 | null {
  if (object.kind !== "controlledBody") return object.velocity ?? null;
  return findControlledBody(world, object.id)?.velocity ?? null;
}

function findControlledBody(world: ExternalWorld, id: ExternalEntityId) {
  for (const body of world.controllableBodies) {
    if (body.id === id) return body;
  }
  return null;
}
