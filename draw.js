// --- DRAWING HELPERS ---

function clear(context) {
  context.fillStyle = "#505050";
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

function draw(context, group, projection) {
  group.forEach((obj) => {
    if (obj.lines.length == 2) {
      const [i, j] = obj.lines;
      const p1 = projection(obj.points[i]);
      const p2 = projection(obj.points[j]);
      if (p1 && p2) line(context, p1, p2, obj.color, obj.lineWidth);
      return;
    }
    for (let i = 0; i < obj.lines.length; i++) {
      let projectedPoints = [];
      for (let j = 0; j < obj.lines[i].length; j++) {
        const p = projection(obj.points[obj.lines[i][j]]);
        if (!p) {
          projectedPoints = [];
          break;
        }
        projectedPoints.push(p);
      }
      if (projectedPoints.length > 0)
        poly(context, projectedPoints, obj.color, obj.lineWidth);
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

  const R = plane.orientation;
  const origin = { x: plane.x, y: plane.y, z: plane.z };

  // Local axes in world space (columns of orientation)
  const [R0, R1, R2] = R;
  const xAxis = { x: R0[0], y: R1[0], z: R2[0] }; // right
  const yAxis = { x: R0[1], y: R1[1], z: R2[1] }; // forward
  const zAxis = { x: R0[2], y: R1[2], z: R2[2] }; // up

  // Endpoints for each axis
  const { x: ox, y: oy, z: oz } = origin;
  const xEnd = {
    x: ox + xAxis.x * axisLength,
    y: oy + xAxis.y * axisLength,
    z: oz + xAxis.z * axisLength,
  };
  const yEnd = {
    x: ox + yAxis.x * axisLength,
    y: oy + yAxis.y * axisLength,
    z: oz + yAxis.z * axisLength,
  };
  const zEnd = {
    x: ox + zAxis.x * axisLength,
    y: oy + zAxis.y * axisLength,
    z: oz + zAxis.z * axisLength,
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
