import type { WorldSegment } from "../app/pluginPorts";
import { ndc } from "./ndc";
import type { ProjectedSegment, SegmentProjector } from "./renderInternals";
import type { RenderedSegment } from "./renderPorts";
import { scrn } from "./scrn";

const projectedScratch: ProjectedSegment = {
  a: ndc.zero(),
  b: ndc.zero(),
  clipped: false,
};

export function renderWorldSegmentsInto(
  into: RenderedSegment[],
  segments: WorldSegment[],
  projectSegmentInto: SegmentProjector,
): number {
  let count = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!projectSegmentInto(projectedScratch, seg.start, seg.end)) continue;
    let entry = into[count];
    if (entry) {
      scrn.copy(projectedScratch.a, entry.start);
      scrn.copy(projectedScratch.b, entry.end);
      entry.cssColor = seg.cssColor;
      entry.lineWidth = seg.lineWidth;
    } else {
      entry = into[count] = {
        start: scrn.copy(projectedScratch.a, scrn.zero()),
        end: scrn.copy(projectedScratch.b, scrn.zero()),
        cssColor: seg.cssColor,
        lineWidth: seg.lineWidth,
      };
    }
    count++;
  }

  return count;
}
