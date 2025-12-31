import { transformPointsToWorld } from "./math.js";
import { topView } from "./projection.js";
import { profilingState as ps } from "./profiling.js";
import { WIDTH, HEIGHT, plane, topCamera, sun } from "./setup.js";

// --- DRAWING HELPERS ---

export function clear(context) {
  context.fillStyle = "#505050";
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

export function draw(context, group, projection) {
  const projectedPoints = [];

  if (ps.doProfile) ps.drawStartTimestamp = performance.now();

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

    if (ps.doProfile) ps.singleOpTimestamp = performance.now();

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
        let R0 = R[0];
        let R1 = R[1];
        let R2 = R[2];
        R0 = [R0[0] * width, R0[1] * depth, R0[2] * height];
        R1 = [R1[0] * width, R1[1] * depth, R1[2] * height];
        R2 = [R2[0] * width, R2[1] * depth, R2[2] * height];
        R = [R0, R1, R2];
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

    if (ps.doProfile)
      ps.drawTransformTime += performance.now() - ps.singleOpTimestamp;

    if (faces && faces.length) {
      if (ps.doProfile) ps.singleOpTimestamp = performance.now();

      drawFilledModel(context, worldPoints, faces, baseColor, projection);

      if (ps.doProfile)
        ps.singleOpTimestamp += performance.now() - ps.singleOpTimestamp;
    } else {
      if (ps.doProfile) ps.singleOpTimestamp = performance.now();

      // wireframe-only path
      if (lines.length == 2 && typeof lines[0] === "number") {
        const [i, j] = lines;
        const p1 = projection(worldPoints[i]);
        const p2 = projection(worldPoints[j]);
        if (p1 && p2) line(context, p1, p2, baseCss, lineWidth);
        return;
      }

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

      if (ps.doProfile)
        ps.singleOpTimestamp += performance.now() - ps.singleOpTimestamp;
    }
  });

  if (ps.doProfile) {
    ps.drawTotalTime += performance.now() - ps.drawStartTimestamp;
  }
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
  const axisLength = 10; // in world units

  const origin = { x: plane.x, y: plane.y, z: plane.z };

  // Local axes in world space (columns of orientation)
  const right = plane.right;
  const forward = plane.forward;
  const up = plane.up;

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

export function drawFilledModel(
  context,
  worldPoints,
  faces,
  baseColor,
  projection
) {
  // Build list of face records with depth for sorting
  const faceRecords = [];

  for (let i = 0; i < faces.length; i++) {
    const indices = faces[i];

    if (ps.doProfile) ps.singleOpTimestamp = performance.now();

    // Optional back-face culling; disable temporarily if debugging:
    if (!isFaceVisible(indices, worldPoints, projection)) continue;

    if (ps.doProfile)
      ps.singleOpTimestamp += performance.now() - ps.singleOpTimestamp;

    // Compute face normal (same as in isFaceVisible; we could refactor, but keep it simple)
    const p0 = worldPoints[indices[0]];
    const p1 = worldPoints[indices[1]];
    const p2 = worldPoints[indices[2]];

    const v1 = {
      x: p1.x - p0.x,
      y: p1.y - p0.y,
      z: p1.z - p0.z,
    };
    const v2 = {
      x: p2.x - p0.x,
      y: p2.y - p0.y,
      z: p2.z - p0.z,
    };

    if (ps.doProfile) ps.singleOpTimestamp = performance.now();

    // Face normal
    const normal = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x,
    };

    // Normalize normal for nicer lighting
    const nLen = Math.hypot(normal.x, normal.y, normal.z);
    if (nLen > 0) {
      normal.x /= nLen;
      normal.y /= nLen;
      normal.z /= nLen;
    }

    if (ps.doProfile)
      ps.singleOpTimestamp += performance.now() - ps.singleOpTimestamp;

    // Project vertices
    const projected = [];
    let avgDepth = 0;
    let valid = true;

    if (ps.doProfile) ps.singleOpTimestamp = performance.now();

    for (let j = 0; j < indices.length; j++) {
      const wp = worldPoints[indices[j]];
      const p = projection(wp);
      if (!p) {
        valid = false;
        break;
      }
      projected.push(p);

      // Approximate depth: for pilotView use distance along view direction (Y in camera space),
      // but we don’t have that here. As a cheap proxy we can use -wp.z or the distance to plane.
      // For now use distance to camera position if available:
      avgDepth += getDepthForSort(wp, projection);
    }

    if (ps.doProfile)
      ps.singleOpTimestamp += performance.now() - ps.singleOpTimestamp;

    if (!valid || projected.length < 3) continue;

    avgDepth /= projected.length;

    const color = shadeColor(baseColor, normal); // returns "rgb(...)"

    faceRecords.push({ projected, avgDepth, color });
  }

  if (ps.doProfile) ps.singleOpTimestamp = performance.now();

  // Painter's algorithm: back-to-front
  faceRecords.sort((a, b) => b.avgDepth - a.avgDepth);

  if (ps.doProfile) {
    ps.singleOpTimestamp += performance.now() - ps.singleOpTimestamp;
    ps.singleOpTimestamp = performance.now();
  }

  // Fill faces
  for (const face of faceRecords) {
    fillPoly(context, face.projected, face.color);
  }

  if (ps.doProfile) {
    ps.singleOpTimestamp += performance.now() - ps.singleOpTimestamp;
    ps.singleOpTimestamp += faces.length;
  }
}

export function getDepthForSort(wp, projection) {
  // Simple heuristic:
  // - For topView: distance in XY from topCamera.
  // - For pilotView: distance from plane.
  if (projection === topView) {
    const dx = wp.x - topCamera.x;
    const dy = wp.y - topCamera.y;
    return dx * dx + dy * dy;
  } else {
    const dx = wp.x - plane.x;
    const dy = wp.y - plane.y;
    const dz = wp.z - plane.z;
    return dx * dx + dy * dy + dz * dz;
  }
}

export function fillPoly(context, points, color) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    context.lineTo(points[i].x, points[i].y);
  }
  context.closePath();
  context.fill();
}

export function isFaceVisible(indices, worldPoints, projection) {
  const p0 = worldPoints[indices[0]];
  const p1 = worldPoints[indices[1]];
  const p2 = worldPoints[indices[2]];

  const v1 = {
    x: p1.x - p0.x,
    y: p1.y - p0.y,
    z: p1.z - p0.z,
  };
  const v2 = {
    x: p2.x - p0.x,
    y: p2.y - p0.y,
    z: p2.z - p0.z,
  };

  // normal = v1 x v2
  const n = {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x,
  };

  let cx, cy, cz;
  if (projection === topView) {
    cx = topCamera.x;
    cy = topCamera.y;
    cz = topCamera.z;
  } else {
    cx = plane.x;
    cy = plane.y;
    cz = plane.z;
  }

  const view = {
    x: p0.x - cx,
    y: p0.y - cy,
    z: p0.z - cz,
  };

  const dot = n.x * view.x + n.y * view.y + n.z * view.z;
  return dot < 0; // front-facing if normal points toward camera
}

export function shadeColor({ r, g, b }, normal) {
  // Very simple fixed ambient + diffuse term
  const len = Math.hypot(sun.x, sun.y, sun.z);
  const lx = sun.x / len;
  const ly = sun.y / len;
  const lz = sun.z / len;

  const dot = Math.max(0, normal.x * lx + normal.y * ly + normal.z * lz);

  const ambient = 0.2;
  const intensity = ambient + (1 - ambient) * dot;

  return `rgb(${Math.round(r * intensity)}, ${Math.round(
    g * intensity
  )}, ${Math.round(b * intensity)})`;
}

export function rgbToCss(c) {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}
