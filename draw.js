// --- DRAWING HELPERS ---

function clear(context) {
  context.fillStyle = "#505050";
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

function draw(context, group, projection) {
  const projectedPoints = [];

  let tTotal = 0,
    tTransform = 0,
    tFaces = 0,
    tLines = 0;

  let t0, t1;

  if (doProfile) t0 = performance.now();

  group.forEach((obj) => {
    const model = obj.model || obj; // backward compatible: old ground/cubes can stay as-is

    const points = model.points;
    const lines = model.lines;
    const faces = model.faces;
    const baseColor = obj.color ?? model.color;
    const lineWidth = obj.lineWidth ?? model.lineWidth;

    // Convert object/model color to CSS once
    const baseCss =
      typeof baseColor === "string" ? baseColor : rgbToCss(baseColor);

    // Dynamic transform?
    const hasTransform =
      obj.x !== undefined &&
      obj.y !== undefined &&
      obj.z !== undefined &&
      obj.orientation &&
      obj.scale !== undefined;

    let worldPoints;

    if (doProfile) t1 = performance.now();

    if (hasTransform) {
      let R = obj.orientation;

      // If the object has per-axis dimensions (our buildings), fold them into R
      if (obj._width && obj._depth && obj._height) {
        const sx = obj._width;
        const sy = obj._depth;
        const sz = obj._height;

        const R0 = [R[0][0] * sx, R[0][1] * sy, R[0][2] * sz];
        const R1 = [R[1][0] * sx, R[1][1] * sy, R[1][2] * sz];
        const R2 = [R[2][0] * sx, R[2][1] * sy, R[2][2] * sz];
        R = [R0, R1, R2];

        worldPoints = transformPointsToWorld(points, R, 1, obj.x, obj.y, obj.z);
      } else {
        // existing path
        worldPoints = transformPointsToWorld(
          points,
          obj.orientation,
          obj.scale,
          obj.x,
          obj.y,
          obj.z
        );
      }
    } else {
      worldPoints = points;
    }

    if (doProfile) tTransform += performance.now() - t1;

    if (faces && faces.length) {
      if (doProfile) t1 = performance.now();

      drawFilledModel(
        context,
        worldPoints,
        faces,
        baseColor, // used by shadeColor
        projection
      );

      if (doProfile) tFaces += performance.now() - t1;
    } else {
      if (doProfile) t1 = performance.now();

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

      if (doProfile) tLines += performance.now() - t1;
    }
  });

  if (doProfile) {
    tTotal += performance.now() - t0;

    console.log(
      `[DRAW profile] total=${tTotal.toFixed(2)}ms ` +
        `transform=${tTransform.toFixed(2)} ` +
        `faces=${tFaces.toFixed(2)} ` +
        `lines=${tLines.toFixed(2)}`
    );
  }
}

function line(context, p1, p2, color, lineWidth) {
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(p1.x, p1.y);
  context.lineTo(p2.x, p2.y);
  context.stroke();
}

function poly(context, points, color, lineWidth) {
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

function drawPlaneAxes(context) {
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

function drawFilledModel(context, worldPoints, faces, baseColor, projection) {
  // Build list of face records with depth for sorting
  const faceRecords = [];

  let tCull = 0,
    tNormal = 0,
    tProject = 0,
    tSort = 0,
    tFill = 0;

  let t0;

  for (let i = 0; i < faces.length; i++) {
    const indices = faces[i];

    if (doProfile) t0 = performance.now();

    // Optional back-face culling; disable temporarily if debugging:
    if (!isFaceVisible(indices, worldPoints, projection)) continue;

    if (doProfile) tCull += performance.now() - t0;

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

    if (doProfile) t0 = performance.now();

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

    if (doProfile) tNormal += performance.now() - t0;

    // Project vertices
    const projected = [];
    let avgDepth = 0;
    let valid = true;

    if (doProfile) t0 = performance.now();

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

    if (doProfile) tProject += performance.now() - t0;

    if (!valid || projected.length < 3) continue;

    avgDepth /= projected.length;

    // Shaded face color
    const shadedCss =
      typeof baseColor === "string" ? baseColor : shadeColor(baseColor, normal); // returns "rgb(...)"

    faceRecords.push({ projected, avgDepth, color: shadedCss });
  }

  if (doProfile) t0 = performance.now();

  // Painter's algorithm: back-to-front
  faceRecords.sort((a, b) => b.avgDepth - a.avgDepth);

  if (doProfile) {
    tSort += performance.now() - t0;
    t0 = performance.now();
  }

  // Fill faces
  for (const face of faceRecords) {
    fillPoly(context, face.projected, face.color);
  }

  if (doProfile) {
    tFill += performance.now() - t0;

    console.log(
      `[FACES profile] faces=${faces.length} ` +
        `cull=${tCull.toFixed(2)} normal=${tNormal.toFixed(2)} ` +
        `project=${tProject.toFixed(2)} sort=${tSort.toFixed(2)} ` +
        `fill=${tFill.toFixed(2)}`
    );
  }
}

function getDepthForSort(wp, projection) {
  // Simple heuristic:
  // - For topView: distance in XY from topCamera.
  // - For pilotView: distance from plane.
  if (projection === topView) {
    const dx = wp.x - topCamera.x;
    const dy = wp.y - topCamera.y;
    return Math.hypot(dx, dy);
  } else {
    const dx = wp.x - plane.x;
    const dy = wp.y - plane.y;
    const dz = wp.z - plane.z;
    return Math.hypot(dx, dy, dz);
  }
}

function fillPoly(context, points, color) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    context.lineTo(points[i].x, points[i].y);
  }
  context.closePath();
  context.fill();
}

function isFaceVisible(indices, worldPoints, projection) {
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

function shadeColor(baseColor, normal) {
  // Very simple fixed ambient + diffuse term
  const len = Math.hypot(lightDir.x, lightDir.y, lightDir.z);
  const lx = lightDir.x / len;
  const ly = lightDir.y / len;
  const lz = lightDir.z / len;

  const dot = Math.max(0, normal.x * lx + normal.y * ly + normal.z * lz);

  const ambient = 0.2;
  const intensity = ambient + (1 - ambient) * dot;

  return `rgb(${Math.round(baseColor.r * intensity)}, ${Math.round(
    baseColor.g * intensity
  )}, ${Math.round(baseColor.b * intensity)})`;
}

function rgbToCss(c) {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}
