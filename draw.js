import { transformPointsToWorld } from "./math.js";
import { topView, pilotView } from "./projection.js";
import { profile } from "./profiling.js";
import { WIDTH, HEIGHT, plane, sun, topCamera } from "./setup.js";
import { vecCross, vecNormalize, vecDot } from "./planet.js";

// --- DRAWING HELPERS ---

export function clear(context) {
  context.fillStyle = "#505050";
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

export function draw(context, group, projection) {
  const projectedPoints = [];

  profile("DRAW", "total", () => {
    group.forEach((obj) => {
      const model = obj.model || obj;

      const points = model.points;
      const lines = model.lines;
      const faces = model.faces;
      const baseColor = obj.color ?? model.color;
      const lineWidth = obj.lineWidth ?? model.lineWidth;

      // Convert object/model color to CSS once
      const baseCss =
        typeof baseColor === "string" ? baseColor : rgbToCss(baseColor);

      let worldPoints;

      profile("DRAW", "transform", () => {
        // Dynamic transform?
        const hasTransform =
          obj.x !== undefined &&
          obj.y !== undefined &&
          obj.z !== undefined &&
          obj.orientation &&
          obj.scale !== undefined;

        if (hasTransform) {
          let R = obj.orientation;

          // If the object has per-axis dimensions, fold them into R
          const width = obj.width;
          const depth = obj.depth;
          const height = obj.height;
          if (width && depth && height) {
            // Each row is the world-space components of the three local axes.
            // To apply non-uniform scale along local X/Y/Z, multiply columns
            // (i.e., the second index), not the rows themselves.
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
            points,
            R,
            obj.scale,
            obj.x,
            obj.y,
            obj.z
          );
        } else {
          worldPoints = points;
        }
      });

      if (faces && faces.length) {
        profile("DRAW", "faces", () => {
          const faceList = [];

          // Camera for culling:
          const cameraPos =
            projection === pilotView
              ? { x: plane.x, y: plane.y, z: plane.z }
              : projection === topView
              ? { x: topCamera.x, y: topCamera.y, z: topCamera.z }
              : null;

          // Base color to RGB
          let baseR = 255,
            baseG = 255,
            baseB = 255;
          if (typeof baseColor !== "string" && baseColor) {
            baseR = baseColor.r;
            baseG = baseColor.g;
            baseB = baseColor.b;
          }

          // Build face list with average depth and intensity
          for (let fi = 0; fi < faces.length; fi++) {
            const [i0, i1, i2] = faces[fi];
            const v0 = worldPoints[i0];
            const v1 = worldPoints[i1];
            const v2 = worldPoints[i2];

            // Face normal in world space: (v1 - v0) × (v2 - v0)
            const e1 = {
              x: v1.x - v0.x,
              y: v1.y - v0.y,
              z: v1.z - v0.z,
            };
            const e2 = {
              x: v2.x - v0.x,
              y: v2.y - v0.y,
              z: v2.z - v0.z,
            };
            const n = vecNormalize(vecCross(e1, e2)); // outward (if faces are CCW)

            // Back-face culling relative to camera (only if we have one)
            if (cameraPos) {
              // Vector from triangle to camera
              const toCamera = {
                x: cameraPos.x - v0.x,
                y: cameraPos.y - v0.y,
                z: cameraPos.z - v0.z,
              };
              const facing = vecDot(n, toCamera);

              // Skip faces whose normal points away from camera
              if (facing <= 0) {
                continue;
              }
            }

            // Simple Lambert factor: max(0, n · sunDir)
            const intensity = Math.max(0, vecDot(n, sun));
            const avgZ = (v0.z + v1.z + v2.z) / 3;

            faceList.push({ i0, i1, i2, intensity, depth: avgZ });
          }

          // Painter’s algorithm: sort back-to-front by depth
          faceList.sort((a, b) => b.depth - a.depth);

          // Draw triangles
          for (const face of faceList) {
            const p0 = projection(worldPoints[face.i0]);
            const p1 = projection(worldPoints[face.i1]);
            const p2 = projection(worldPoints[face.i2]);
            if (!p0 || !p1 || !p2) continue;

            // Apply intensity to base color
            const k = 0.2 + 0.8 * face.intensity; // ambient 0.2, diffuse up to 1.0
            const r = Math.round(baseR * k);
            const g = Math.round(baseG * k);
            const b = Math.round(baseB * k);
            const fillStyle = `rgb(${r}, ${g}, ${b})`;

            fillTriangle(context, p0, p1, p2, fillStyle);
          }
        });

        // Optional: also draw wireframe on top if you want the mesh look
        // profile("DRAW", "lines-over-faces", () => {
        //   for (let i = 0; i < lines.length; i++) {
        //     const polyIndices = lines[i];
        //     projectedPoints.length = 0;
        //
        //     for (let j = 0; j < polyIndices.length; j++) {
        //       const p = projection(worldPoints[polyIndices[j]]);
        //       if (!p) {
        //         projectedPoints.length = 0;
        //         break;
        //       }
        //       projectedPoints.push(p);
        //     }
        //     if (projectedPoints.length > 0)
        //       poly(context, projectedPoints, "rgba(0,0,0,0.3)", lineWidth);
        //   }
        // });
      } else {
        profile("DRAW", "lines", () => {
          // wireframe lines
          if (lines.length == 2 && typeof lines[0] === "number") {
            const [i, j] = lines;
            const p1 = projection(worldPoints[i]);
            const p2 = projection(worldPoints[j]);
            if (p1 && p2) line(context, p1, p2, baseCss, lineWidth);
            return;
          }

          // wireframe polys
          for (let i = 0; i < lines.length; i++) {
            const polyIndices = lines[i];
            projectedPoints.length = 0;

            for (let j = 0; j < polyIndices.length; j++) {
              const p = projection(worldPoints[polyIndices[j]]);
              if (!p) {
                projectedPoints.length = 0;
                break;
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

export function line(context, p1, p2, color, lineWidth) {
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(p1.x, p1.y);
  context.lineTo(p2.x, p2.y);
  context.stroke();
}

export function poly(context, points, color, lineWidth) {
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

export function drawPlaneAxes(context) {
  const axisLength = 10;

  const origin = { x: plane.x, y: plane.y, z: plane.z };

  const right = {
    x: plane.orientation[0][0],
    y: plane.orientation[1][0],
    z: plane.orientation[2][0],
  };
  const forward = {
    x: plane.orientation[0][1],
    y: plane.orientation[1][1],
    z: plane.orientation[2][1],
  };
  const up = {
    x: plane.orientation[0][2],
    y: plane.orientation[1][2],
    z: plane.orientation[2][2],
  };

  // Endpoints for each axis
  const { x: ox, y: oy, z: oz } = origin;
  const xEnd = {
    x: ox + right.x * axisLength,
    y: oy + right.y * axisLength,
    z: oz + right.z * axisLength,
  };
  const yEnd = {
    x: ox + forward.x * axisLength,
    y: oy + forward.y * axisLength,
    z: oz + forward.z * axisLength,
  };
  const zEnd = {
    x: ox + up.x * axisLength,
    y: oy + up.y * axisLength,
    z: oz + up.z * axisLength,
  };

  // Project to top view
  const oTop = topView(origin);
  const xTop = topView(xEnd);
  const yTop = topView(yEnd);
  const zTop = topView(zEnd);

  if (!oTop) return;

  context.lineWidth = 2;

  // X axis: red
  if (xTop) {
    context.strokeStyle = "red";
    context.beginPath();
    context.moveTo(oTop.x, oTop.y);
    context.lineTo(xTop.x, xTop.y);
    context.stroke();
  }

  // Y axis: green
  if (yTop) {
    context.strokeStyle = "lime";
    context.beginPath();
    context.moveTo(oTop.x, oTop.y);
    context.lineTo(yTop.x, yTop.y);
    context.stroke();
  }

  // Z axis: blue
  if (zTop) {
    context.strokeStyle = "blue";
    context.beginPath();
    context.moveTo(oTop.x, oTop.y);
    context.lineTo(zTop.x, zTop.y);
    context.stroke();
  }
}

function rgbToCss({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

function fillTriangle(context, p0, p1, p2, fillStyle) {
  context.fillStyle = fillStyle;
  context.beginPath();
  context.moveTo(p0.x, p0.y);
  context.lineTo(p1.x, p1.y);
  context.lineTo(p2.x, p2.y);
  context.closePath();
  context.fill();
}
