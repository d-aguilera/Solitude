// --- PROFILING ---

const profileEveryNFrames = 180;

let doProfile;
let frameCountForProfile = 0;

let startTimestamp;
let physicsTimestamp;
let physicsTime;
let cameraTimestamp;
let cameraTime;
let groundTimestamp;
let groundTime;
let pilotViewTimestamp;
let pilotViewTime;
let topViewTimestamp;
let topViewTime;
let hudTimestamp;
let hudTime;
let totalTime;

let drawStartTimestamp;
let singleOpTimestamp;

let drawTotalTime;
let drawTransformTime;
let drawFacesTime;
let drawLinesTime;
let facesCount;
let facesCullTime;
let facesNormalTime;
let facesProjectTime;
let facesSortTime;
let facesFillTime;

function profilingCheck() {
  frameCountForProfile++;

  if (paused) return;

  if (frameCountForProfile < profileEveryNFrames) {
    doProfile = false;
    return;
  }

  doProfile = true;
  frameCountForProfile = 0;
  profilingStart();
}

function profilingStart() {
  drawTotalTime = 0;
  drawTransformTime = 0;
  drawFacesTime = 0;
  drawLinesTime = 0;
  facesCount = 0;
  facesCullTime = 0;
  facesNormalTime = 0;
  facesProjectTime = 0;
  facesSortTime = 0;
  facesFillTime = 0;

  startTimestamp = performance.now();
}

function profilingFlush() {
  physicsTime = physicsTimestamp - startTimestamp;
  cameraTime = cameraTimestamp - physicsTimestamp;
  groundTime = groundTimestamp - cameraTimestamp;
  pilotViewTime = pilotViewTimestamp - groundTimestamp;
  topViewTime = topViewTimestamp - pilotViewTimestamp;
  hudTime = hudTimestamp - topViewTimestamp;
  totalTime = hudTimestamp - startTimestamp;

  console.log(
    "".concat(
      "[PROFILE] ",
      "total=",
      totalTime.toFixed(2),
      ", ",
      "physics=",
      physicsTime.toFixed(2),
      ", ",
      "camera=",
      cameraTime.toFixed(2),
      ", ",
      "ground=",
      groundTime.toFixed(2),
      ", ",
      "pilotView=",
      pilotViewTime.toFixed(2),
      ", ",
      "topView=",
      topViewTime.toFixed(2)
    )
  );

  console.log(
    "".concat(
      "[DRAW profile] ",
      "total=",
      drawTotalTime.toFixed(2),
      ", ",
      "transform=",
      drawTransformTime.toFixed(2),
      ", ",
      "faces=",
      drawFacesTime.toFixed(2),
      ", ",
      "lines=",
      drawLinesTime.toFixed(2)
    )
  );

  console.log(
    "".concat(
      "[FACES profile] ",
      "count=",
      facesCount,
      ", ",
      "cull=",
      facesCullTime.toFixed(2),
      ", ",
      "normal=",
      facesNormalTime.toFixed(2),
      ", ",
      "project=",
      facesProjectTime.toFixed(2),
      ", ",
      "sort=",
      facesSortTime.toFixed(2),
      ", ",
      "fill=",
      facesFillTime.toFixed(2)
    )
  );
}
