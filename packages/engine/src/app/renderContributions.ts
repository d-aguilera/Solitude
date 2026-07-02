import { vec3 } from "../domain/vec3";
import type {
  SceneLabelCandidate,
  SceneLabelSink,
  WorldMarker,
  WorldMarkerShape,
  WorldMarkerSink,
  WorldSegment,
  WorldSegmentSink,
} from "./pluginPorts";
import type { RGB } from "./scenePorts";

export function createSceneLabelBuffer(): SceneLabelSink {
  return new ReusableSceneLabelBuffer();
}

export function createWorldSegmentBuffer(): WorldSegmentSink {
  return new ReusableWorldSegmentBuffer();
}

export function createWorldMarkerBuffer(): WorldMarkerSink {
  return new ReusableWorldMarkerBuffer();
}

class ReusableWorldSegmentBuffer implements WorldSegmentSink {
  readonly items: WorldSegment[] = [];
  count = 0;

  addSegment(
    start: WorldSegment["start"],
    end: WorldSegment["end"],
    color: RGB,
    lineWidth: number,
  ): WorldSegment {
    const index = this.count;
    let segment = this.items[index];
    if (!segment) {
      segment = {
        start: vec3.zero(),
        end: vec3.zero(),
        color: createRgb(),
        lineWidth: 0,
      };
      this.items[index] = segment;
    }
    vec3.copyInto(segment.start, start);
    vec3.copyInto(segment.end, end);
    copyRgbInto(segment.color, color);
    segment.lineWidth = lineWidth;
    this.count++;
    return segment;
  }

  reset(): void {
    this.count = 0;
  }
}

class ReusableWorldMarkerBuffer implements WorldMarkerSink {
  readonly items: WorldMarker[] = [];
  count = 0;

  addMarker(
    position: WorldMarker["position"],
    color: RGB,
    radius: number,
    lineWidth: number,
    shape: WorldMarkerShape,
  ): WorldMarker {
    const index = this.count;
    let marker = this.items[index];
    if (!marker) {
      marker = {
        position: vec3.zero(),
        color: createRgb(),
        radius: 0,
        lineWidth: 0,
        shape,
      };
      this.items[index] = marker;
    }
    vec3.copyInto(marker.position, position);
    copyRgbInto(marker.color, color);
    marker.radius = radius;
    marker.lineWidth = lineWidth;
    marker.shape = shape;
    this.count++;
    return marker;
  }

  reset(): void {
    this.count = 0;
  }
}

class ReusableSceneLabelBuffer implements SceneLabelSink {
  readonly items: SceneLabelCandidate[] = [];
  count = 0;

  addLabel(
    id: string,
    anchor: SceneLabelCandidate["anchor"],
    lines: readonly string[],
    parentId?: SceneLabelCandidate["parentId"],
    priority?: number,
  ): SceneLabelCandidate {
    const index = this.count;
    let label = this.items[index] as MutableSceneLabelCandidate | undefined;
    if (!label) {
      label = {
        id: "",
        anchor: vec3.zero(),
        lines: [],
      };
      this.items[index] = label;
    }
    label.id = id;
    vec3.copyInto(label.anchor, anchor);
    copyLinesInto(label.lines, lines);
    label.parentId = parentId;
    label.priority = priority;
    this.count++;
    return label;
  }

  reset(): void {
    this.count = 0;
  }
}

type MutableSceneLabelCandidate = Omit<SceneLabelCandidate, "lines"> & {
  lines: string[];
};

function createRgb(): RGB {
  return { r: 0, g: 0, b: 0 };
}

function copyRgbInto(into: RGB, color: RGB): RGB {
  into.r = color.r;
  into.g = color.g;
  into.b = color.b;
  return into;
}

function copyLinesInto(into: string[], lines: readonly string[]): string[] {
  const lineCount = lines.length;
  for (let i = 0; i < lineCount; i++) {
    into[i] = lines[i];
  }
  into.length = lineCount;
  return into;
}
