import { HEIGHT, WIDTH } from "./config.js";
import { transformPointsToWorld, vec } from "./math.js";
import type { ScreenPoint } from "./projection.js";
import type {
  InstrumentationAdapter,
  Model,
  Renderable,
  RGB,
  SceneObject,
  Vec3,
} from "./types.js";

type ProjectionFn = (p: Vec3) => ScreenPoint | null;

interface DrawOptions {
  projection: ProjectionFn;
  cameraPos: Vec3 | null;
  lightDir: Vec3;
  instrument: InstrumentationAdapter;
}

export function clear(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#505050";
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

export function draw(
  context: CanvasRenderingContext2D,
  group: (Model | SceneObject)[],
  {
    projection,
    cameraPos,
    lightDir,
    instrument: instrumentationAdapter,
  }: DrawOptions
): void {
  const projectedPoints: ScreenPoint[] = [];

  instrumentationAdapter("DRAW", "total", () => {
    group.forEach((obj) => {
      const { model, worldPoints, color, lineWidth } = toRenderable(obj);
      const { lines, faces } = model;

      const baseCss = color;

      if (faces && faces.length) {
        instrumentationAdapter("DRAW", "faces", () => {
          const faceList: {
            i0: number;
            i1: number;
            i2: number;
            intensity: number;
            depth: number;
          }[] = [];

          let baseR = 255,
            baseG = 255,
            baseB = 255;
          if (typeof model.color !== "string" && model.color) {
            baseR = model.color.r;
            baseG = model.color.g;
            baseB = model.color.b;
          }

          for (let fi = 0; fi < faces.length; fi++) {
            const [i0, i1, i2] = faces[fi];
            const v0 = worldPoints[i0];
            const v1 = worldPoints[i1];
            const v2 = worldPoints[i2];

            const e1: Vec3 = {
              x: v1.x - v0.x,
              y: v1.y - v0.y,
              z: v1.z - v0.z,
            };
            const e2: Vec3 = {
              x: v2.x - v0.x,
              y: v2.y - v0.y,
              z: v2.z - v0.z,
            };
            const n = vec.normalize(vec.cross(e1, e2));

            if (cameraPos) {
              const toCamera: Vec3 = {
                x: cameraPos.x - v0.x,
                y: cameraPos.y - v0.y,
                z: cameraPos.z - v0.z,
              };
              const facing = vec.dot(n, toCamera);
              if (facing <= 0) {
                continue;
              }
            }

            const intensity = Math.max(0, vec.dot(n, lightDir));
            const avgZ = (v0.z + v1.z + v2.z) / 3;

            faceList.push({ i0, i1, i2, intensity, depth: avgZ });
          }

          faceList.sort((a, b) => b.depth - a.depth);

          for (const face of faceList) {
            const p0 = projection(worldPoints[face.i0]);
            const p1 = projection(worldPoints[face.i1]);
            const p2 = projection(worldPoints[face.i2]);
            if (!p0 || !p1 || !p2) continue;

            const k = 0.2 + 0.8 * face.intensity;
            const r = Math.round(baseR * k);
            const g = Math.round(baseG * k);
            const b = Math.round(baseB * k);
            const fillStyle = `rgb(${r}, ${g}, ${b})`;

            fillTriangle(context, p0, p1, p2, fillStyle);
          }
        });
      } else {
        instrumentationAdapter("DRAW", "lines", () => {
          for (let i = 0; i < lines.length; i++) {
            const polyIndices = lines[i];

            if (polyIndices.length === 2) {
              const [i, j] = polyIndices;
              const p1 = projection(worldPoints[i]);
              const p2 = projection(worldPoints[j]);
              if (p1 && p2) line(context, p1, p2, baseCss, lineWidth);
              continue;
            }

            projectedPoints.length = 0;

            for (let j = 0; j < polyIndices.length; j++) {
              const p = projection(worldPoints[polyIndices[j]]);
              if (!p) {
                projectedPoints.length = 0;
                continue;
              }
              projectedPoints.push(p);
            }
            if (projectedPoints.length > 0)
              poly(context, projectedPoints, baseCss, lineWidth);
          }
        });
      }
    });
  });
}

export function line(
  context: CanvasRenderingContext2D,
  p1: ScreenPoint,
  p2: ScreenPoint,
  color: string,
  lineWidth: number
): void {
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(p1.x, p1.y);
  context.lineTo(p2.x, p2.y);
  context.stroke();
}

export function poly(
  context: CanvasRenderingContext2D,
  points: ScreenPoint[],
  color: string,
  lineWidth: number
): void {
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    context.lineTo(points[i].x, points[i].y);
  }
  context.closePath();
  context.stroke();
}

function rgbToCss({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function fillTriangle(
  context: CanvasRenderingContext2D,
  p0: ScreenPoint,
  p1: ScreenPoint,
  p2: ScreenPoint,
  fillStyle: string
): void {
  context.fillStyle = fillStyle;
  context.beginPath();
  context.moveTo(p0.x, p0.y);
  context.lineTo(p1.x, p1.y);
  context.lineTo(p2.x, p2.y);
  context.closePath();
  context.fill();
}

function toRenderable(obj: Model | SceneObject): Renderable {
  const sceneObj = obj as SceneObject;
  const model: Model = sceneObj.model ?? (obj as Model);
  const baseColor = sceneObj.color ?? model.color;
  const lineWidth = sceneObj.lineWidth ?? model.lineWidth;

  let worldPoints: Vec3[];

  const hasTransform =
    sceneObj.x !== undefined &&
    sceneObj.y !== undefined &&
    sceneObj.z !== undefined &&
    !!sceneObj.orientation &&
    sceneObj.scale !== undefined;

  if (hasTransform) {
    let R = sceneObj.orientation;

    const width = sceneObj.width;
    const depth = sceneObj.depth;
    const height = sceneObj.height;
    if (width && depth && height) {
      const R00 = R[0][0] * width;
      const R01 = R[0][1] * depth;
      const R02 = R[0][2] * height;

      const R10 = R[1][0] * width;
      const R11 = R[1][1] * depth;
      const R12 = R[1][2] * height;

      const R20 = R[2][0] * width;
      const R21 = R[2][1] * depth;
      const R22 = R[2][2] * height;

      R = [
        [R00, R01, R02],
        [R10, R11, R12],
        [R20, R21, R22],
      ];
    }

    worldPoints = transformPointsToWorld(
      model.points,
      R,
      sceneObj.scale,
      sceneObj.x,
      sceneObj.y,
      sceneObj.z
    );
  } else {
    worldPoints = model.points;
  }

  const colorCss =
    typeof baseColor === "string" ? baseColor : rgbToCss(baseColor);

  return {
    model,
    worldPoints,
    color: colorCss,
    lineWidth,
  };
}
