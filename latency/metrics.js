const handler = () =>
  console.log(JSON.stringify(window.__solitudeInterpolationMetrics));
const intervalId = window.setInterval(handler, 2000);

// later:
// window.clearInterval(intervalId);
