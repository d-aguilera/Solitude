import { vec3, type Vec3 } from "@solitude/engine/math";
import type {
  GamePlugin,
  SceneLabelCandidate,
  SceneLabelPlugin,
} from "@solitude/engine/plugin";
import {
  formatDistance,
  formatSpeed,
  type BodySceneObject,
  type ControlledBodySceneObject,
  type LightEmitterSceneObject,
  type SceneObject,
} from "@solitude/engine/render";
import type { EntityId, World } from "@solitude/engine/world";

const distanceScratch: Vec3 = vec3.zero();

type MutableSceneLabelCandidate = SceneLabelCandidate & {
  lines: string[];
};

export function createBodyLabelsPlugin(): GamePlugin {
  return {
    id: "bodyLabels",
    labels: createSceneLabelPlugin(),
  };
}

function createSceneLabelPlugin(): SceneLabelPlugin {
  const candidatesById = new Map<string, MutableSceneLabelCandidate>();
  const displayNamesById = new Map<string, string>();

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
        const candidate = getCandidate(candidatesById, object.id);
        candidate.anchor = object.position;
        candidate.parentId =
          object.kind === "controlledBody" ? undefined : object.centralEntityId;
        candidate.priority = -distance;
        writeLabelLines(
          candidate.lines,
          params.labelMode,
          getDisplayName(displayNamesById, object),
          distance,
          velocity ? vec3.length(velocity) : 0,
        );
        into.push(candidate);
      }
    },
  };
}

function getCandidate(
  candidatesById: Map<string, MutableSceneLabelCandidate>,
  id: string,
): MutableSceneLabelCandidate {
  let candidate = candidatesById.get(id);
  if (!candidate) {
    candidate = {
      id,
      anchor: vec3.zero(),
      lines: [],
    };
    candidatesById.set(id, candidate);
  }
  return candidate;
}

function writeLabelLines(
  into: string[],
  labelMode: "full" | "nameOnly",
  displayName: string,
  distance: number,
  speed: number,
): void {
  into[0] = displayName;
  if (labelMode === "nameOnly") {
    into.length = 1;
    return;
  }
  into[1] = "d=".concat(formatDistance(distance));
  into[2] = "v=".concat(formatSpeed(speed));
  into.length = 3;
}

function getDisplayName(
  displayNamesById: Map<string, string>,
  object: SceneObject,
) {
  if (object.displayName) return object.displayName;
  let displayName = displayNamesById.get(object.id);
  if (!displayName) {
    displayName = displayNameForBodyId(object.id);
    displayNamesById.set(object.id, displayName);
  }
  return displayName;
}

function displayNameForBodyId(id: string): string {
  const parts = id.split(":");
  const raw = parts[parts.length - 1] || id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
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
