import { vec3, type Vec3 } from "@solitude/engine/math";
import type {
  GamePlugin,
  SceneLabelCandidate,
  SceneLabelPlugin,
} from "@solitude/engine/plugin";
import { formatDistance, formatSpeed } from "@solitude/engine/render";

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
        if (object.kind !== "orbitalBody" && object.kind !== "lightEmitter") {
          continue;
        }

        vec3.subInto(distanceScratch, object.position, referencePosition);
        const distance = vec3.length(distanceScratch);
        const candidate = getCandidate(candidatesById, object.id);
        candidate.anchor = object.position;
        candidate.parentId = object.centralEntityId;
        candidate.priority = -distance;
        writeLabelLines(
          candidate.lines,
          params.labelMode,
          getDisplayName(displayNamesById, object.id),
          distance,
          vec3.length(object.velocity),
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

function getDisplayName(displayNamesById: Map<string, string>, id: string) {
  let displayName = displayNamesById.get(id);
  if (!displayName) {
    displayName = displayNameForBodyId(id);
    displayNamesById.set(id, displayName);
  }
  return displayName;
}

function displayNameForBodyId(id: string): string {
  const parts = id.split(":");
  const raw = parts[parts.length - 1] || id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
