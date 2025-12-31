// --- PROFILING ---

export const profileEveryNFrames = 180;

export const profilingState = {
  doProfile: false,
  frameCountForProfile: 0,

  startTimestamp: 0,
  physicsTimestamp: 0,
  physicsTime: 0,
  cameraTimestamp: 0,
  cameraTime: 0,
  groundTimestamp: 0,
  groundTime: 0,
  pilotViewTimestamp: 0,
  pilotViewTime: 0,
  topViewTimestamp: 0,
  topViewTime: 0,
  hudTimestamp: 0,
  hudTime: 0,
  totalTime: 0,

  drawStartTimestamp: 0,
  singleOpTimestamp: 0,

  drawTotalTime: 0,
  drawTransformTime: 0,
  drawFacesTime: 0,
  drawLinesTime: 0,
  facesCount: 0,
  facesCullTime: 0,
  facesNormalTime: 0,
  facesProjectTime: 0,
  facesSortTime: 0,
  facesFillTime: 0,
};

export function profilingCheck(paused) {
  const ps = profilingState;
  ps.frameCountForProfile++;

  if (paused) return;

  if (ps.frameCountForProfile < profileEveryNFrames) {
    ps.doProfile = false;
    return;
  }

  ps.doProfile = true;
  ps.frameCountForProfile = 0;
  profilingStart();
}

export function profilingStart() {
  const ps = profilingState;

  ps.drawTotalTime = 0;
  ps.drawTransformTime = 0;
  ps.drawFacesTime = 0;
  ps.drawLinesTime = 0;
  ps.facesCount = 0;
  ps.facesCullTime = 0;
  ps.facesNormalTime = 0;
  ps.facesProjectTime = 0;
  ps.facesSortTime = 0;
  ps.facesFillTime = 0;

  ps.startTimestamp = performance.now();
}

export function profilingFlush() {
  const ps = profilingState;

  ps.physicsTime = ps.physicsTimestamp - ps.startTimestamp;
  ps.cameraTime = ps.cameraTimestamp - ps.physicsTimestamp;
  ps.groundTime = ps.groundTimestamp - ps.cameraTimestamp;
  ps.pilotViewTime = ps.pilotViewTimestamp - ps.groundTimestamp;
  ps.topViewTime = ps.topViewTimestamp - ps.pilotViewTimestamp;
  ps.hudTime = ps.hudTimestamp - ps.topViewTimestamp;
  ps.totalTime = ps.hudTimestamp - ps.startTimestamp;

  console.log(
    "".concat(
      "[PROFILE] ",
      "total=",
      ps.totalTime.toFixed(2),
      ", ",
      "physics=",
      ps.physicsTime.toFixed(2),
      ", ",
      "camera=",
      ps.cameraTime.toFixed(2),
      ", ",
      "ground=",
      ps.groundTime.toFixed(2),
      ", ",
      "pilotView=",
      ps.pilotViewTime.toFixed(2),
      ", ",
      "topView=",
      ps.topViewTime.toFixed(2)
    )
  );

  console.log(
    "".concat(
      "[DRAW profile] ",
      "total=",
      ps.drawTotalTime.toFixed(2),
      ", ",
      "transform=",
      ps.drawTransformTime.toFixed(2),
      ", ",
      "faces=",
      ps.drawFacesTime.toFixed(2),
      ", ",
      "lines=",
      ps.drawLinesTime.toFixed(2)
    )
  );

  console.log(
    "".concat(
      "[FACES profile] ",
      "count=",
      ps.facesCount,
      ", ",
      "cull=",
      ps.facesCullTime.toFixed(2),
      ", ",
      "normal=",
      ps.facesNormalTime.toFixed(2),
      ", ",
      "project=",
      ps.facesProjectTime.toFixed(2),
      ", ",
      "sort=",
      ps.facesSortTime.toFixed(2),
      ", ",
      "fill=",
      ps.facesFillTime.toFixed(2)
    )
  );
}
