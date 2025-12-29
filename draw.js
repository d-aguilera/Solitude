// --- DRAWING HELPERS ---

function clear(context) {
  context.fillStyle = "#505050";
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

function draw(context, group, projection) {
  const projectedPoints = [];

  group.forEach((obj) => {
    const model = obj.model || obj; // backward compatible: old ground/cubes can stay as-is

    const points = model.points;
    const lines = model.lines;
    const color = obj.color ?? model.color;
    const lineWidth = obj.lineWidth ?? model.lineWidth;

    // Precompute plane/world transform if this is a "dynamic" object
    const hasTransform =
      obj.x !== undefined &&
      obj.y !== undefined &&
      obj.z !== undefined &&
      obj.orientation &&
      obj.scale !== undefined;

    const worldPoints = hasTransform
      ? transformPointsToWorld(
          points,
          obj.orientation,
          obj.scale,
          obj.x,
          obj.y,
          obj.z
        )
      : points;

    if (lines.length == 2 && typeof lines[0] === "number") {
      const [i, j] = lines;
      const p1 = projection(worldPoints[i]);
      const p2 = projection(worldPoints[j]);
      if (p1 && p2) line(context, p1, p2, color, lineWidth);
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
        poly(context, projectedPoints, color, lineWidth);
    }
  });
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
