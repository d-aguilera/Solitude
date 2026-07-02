import { vec3 } from "../domain/vec3";
import type {
  WorldMarker,
  WorldMarkerShape,
  WorldMarkerSink,
  WorldSegment,
  WorldSegmentSink,
} from "./pluginPorts";
import type { RGB } from "./scenePorts";

export function createWorldSegmentBuffer(): WorldSegmentSink {
  return new ReusableWorldSegmentBuffer();
}

export function createWorldMarkerBuffer(): WorldMarkerSink {
  return new ReusableWorldMarkerBuffer();
}

class ReusableWorldSegmentBuffer implements WorldSegmentSink {
  private readonly owned: boolean[] = [];
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
    if (!segment || !this.owned[index]) {
      segment = {
        start: vec3.zero(),
        end: vec3.zero(),
        color: createRgb(),
        lineWidth: 0,
      };
      this.items[index] = segment;
      this.owned[index] = true;
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
  private readonly owned: boolean[] = [];
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
    if (!marker || !this.owned[index]) {
      marker = {
        position: vec3.zero(),
        color: createRgb(),
        radius: 0,
        lineWidth: 0,
        shape,
      };
      this.items[index] = marker;
      this.owned[index] = true;
    }
    vec3.copyInto(marker.position, position);
    copyRgbInto(marker.color, color);
    marker.radius = radius;
    marker.lineWidth = lineWidth;
    marker.shape = shape;
    this.count++;
    return marker;
  }

  push(...markers: WorldMarker[]): number {
    for (let i = 0; i < markers.length; i++) {
      this.items[this.count] = markers[i];
      this.owned[this.count] = false;
      this.count++;
    }
    return this.count;
  }

  reset(): void {
    this.count = 0;
  }
}

function createRgb(): RGB {
  return { r: 0, g: 0, b: 0 };
}

function copyRgbInto(into: RGB, color: RGB): RGB {
  into.r = color.r;
  into.g = color.g;
  into.b = color.b;
  return into;
}
