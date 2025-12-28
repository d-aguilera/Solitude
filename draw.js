// --- DRAWING HELPERS ---

function clear(context) {
  context.fillStyle = "#505050";
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

function draw(context, group, projection) {
  group.forEach((o) => {
    if (o.lines.length == 2) {
      const [i, j] = o.lines;
      const p1 = projection(o.points[i]);
      const p2 = projection(o.points[j]);
      if (p1 && p2) line(context, p1, p2, o.color, o.lineWidth);
      return;
    }
    for (let i = 0; i < o.lines.length; i++) {
      let projectedPoints = [];
      for (let j = 0; j < o.lines[i].length; j++) {
        const p = projection(o.points[o.lines[i][j]]);
        if (!p) {
          projectedPoints = [];
          break;
        }
        projectedPoints.push(p);
      }
      if (projectedPoints.length > 0)
        poly(context, projectedPoints, o.color, o.lineWidth);
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
