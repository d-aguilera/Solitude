let sequence = 1;
let events = null;
let runActive = false;

const heldControls = {};

const keyMap = {
  Digit0: "thrust0",
  Digit1: "thrust1",
  Digit2: "thrust2",
  Digit3: "thrust3",
  Digit4: "thrust4",
  Digit5: "thrust5",
  Digit6: "thrust6",
  Digit7: "thrust7",
  Digit8: "thrust8",
  Digit9: "thrust9",
  KeyA: "yawLeft",
  KeyB: "burnBackwards",
  KeyD: "yawRight",
  KeyE: "rollRight",
  KeyM: "burnRight",
  KeyN: "burnLeft",
  KeyQ: "rollLeft",
  KeyS: "pitchDown",
  KeyW: "pitchUp",
  Space: "burnForward",
};

const fields = {
  clientId: document.querySelector("#clientId"),
  gameId: document.querySelector("#gameId"),
  entityId: document.querySelector("#entityId"),
  dtMillis: document.querySelector("#dtMillis"),
  runIntervalMillis: document.querySelector("#runIntervalMillis"),
};
const logEl = document.querySelector("#log");
const keyStatusEl = document.querySelector("#keyStatus");
const snapshotCanvas = document.querySelector("#snapshotCanvas");
const snapshotContext = snapshotCanvas.getContext("2d");
const snapshotStatusEl = document.querySelector("#snapshotStatus");
const statusEl = document.querySelector("#status");
const runStatusEl = document.querySelector("#runStatus");
const toggleRunButton = document.querySelector("#toggleRun");

document.querySelector("#createGame").addEventListener("click", () => {
  sendMessage({
    type: "createGame",
    clientId: fields.clientId.value,
    sequence: nextSequence(),
  });
});

document.querySelector("#joinGame").addEventListener("click", () => {
  sendMessage({
    type: "joinGame",
    clientId: fields.clientId.value,
    gameId: fields.gameId.value,
    sequence: nextSequence(),
  });
});

document
  .querySelector("#connectEvents")
  .addEventListener("click", connectEvents);

toggleRunButton.addEventListener("click", toggleRun);

window.addEventListener(
  "keydown",
  (event) => {
    void handleKeyboardInput(event, true);
  },
  { capture: true },
);

window.addEventListener(
  "keyup",
  (event) => {
    void handleKeyboardInput(event, false);
  },
  { capture: true },
);

async function sendMessage(message) {
  const response = await fetch("/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(message),
  });
  const payload = await response.json();
  handleMessages(payload.messages, { connectAfterJoin: true });
}

async function handleKeyboardInput(event, isDown) {
  if (isTextInputTarget(event.target)) return;
  const action = keyMap[event.code];
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.repeat) return;
  if (!fields.gameId.value || !fields.entityId.value) {
    keyStatusEl.textContent = "Keyboard controls waiting for assigned entity";
    return;
  }
  if (heldControls[action] === isDown) return;
  heldControls[action] = isDown;
  keyStatusEl.textContent = action + " " + (isDown ? "held" : "released");
  await sendMessage({
    type: "input",
    clientId: fields.clientId.value,
    entityId: fields.entityId.value,
    gameId: fields.gameId.value,
    sequence: nextSequence(),
    controls: { [action]: isDown },
  });
}

function toggleRun() {
  if (runActive) {
    void pauseServerLoop();
    return;
  }
  if (!fields.gameId.value) {
    statusEl.textContent = "Create or join a game before running";
    return;
  }
  void startServerLoop();
}

async function startServerLoop() {
  const intervalMillis = Math.max(
    50,
    Number(fields.runIntervalMillis.value) || 250,
  );
  fields.runIntervalMillis.value = String(intervalMillis);
  const dtMillis = Math.max(1, Number(fields.dtMillis.value) || 1000);
  fields.dtMillis.value = String(dtMillis);
  const response = await fetch("/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: fields.gameId.value,
      dtMillis,
      intervalMillis,
    }),
  });
  const payload = await response.json();
  handleMessages(payload.messages);
  runActive = true;
  runStatusEl.textContent =
    "Server running every " + intervalMillis + " ms at dt " + dtMillis + " ms";
  toggleRunButton.textContent = "Pause";
}

async function pauseServerLoop() {
  if (!fields.gameId.value) {
    runActive = false;
    runStatusEl.textContent = "Paused";
    toggleRunButton.textContent = "Run";
    return;
  }
  const response = await fetch("/pause", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId: fields.gameId.value }),
  });
  const payload = await response.json();
  handleMessages(payload.messages);
  runActive = false;
  runStatusEl.textContent = "Paused";
  toggleRunButton.textContent = "Run";
}

function connectEvents() {
  if (!fields.gameId.value) {
    statusEl.textContent =
      "Create or join a game before connecting the snapshot stream";
    return;
  }
  if (events) events.close();
  events = new EventSource(
    "/events?gameId=" + encodeURIComponent(fields.gameId.value),
  );
  events.addEventListener("ready", (event) => {
    statusEl.textContent =
      "Snapshot stream connected for " + JSON.parse(event.data).gameId;
  });
  events.onmessage = (event) => {
    handleMessages([JSON.parse(event.data)]);
  };
  events.onerror = () => {
    statusEl.textContent = "SSE reconnecting";
  };
}

function handleMessages(messages, options = {}) {
  for (const message of messages) {
    if (message.type === "gameCreated") {
      fields.gameId.value = message.gameId;
    }
    if (message.type === "joined") {
      fields.gameId.value = message.gameId;
      fields.entityId.value = message.entityId;
      if (options.connectAfterJoin) connectEvents();
    }
    if (message.type === "snapshot") {
      renderSnapshot(message);
      if (options.suppressSnapshots) continue;
      statusEl.textContent =
        "tick " +
        message.tick +
        " | entities " +
        message.snapshot.entities.length;
    }
    log(message);
  }
}

function renderSnapshot(message) {
  if (!snapshotContext) return;
  const entities = message.snapshot.entities.filter((entity) =>
    isFiniteVec3(entity.position),
  );
  const width = snapshotCanvas.width;
  const height = snapshotCanvas.height;
  snapshotContext.clearRect(0, 0, width, height);
  snapshotContext.fillStyle = "#030504";
  snapshotContext.fillRect(0, 0, width, height);

  const focus =
    entities.find((entity) => entity.id === fields.entityId.value) ??
    entities[0];
  const focusPosition = focus?.position ?? { x: 0, y: 0, z: 0 };
  const scale = Math.min(width, height) * 0.055;
  const centerX = width * 0.5;
  const centerY = height * 0.5;

  drawGrid(snapshotContext, width, height);
  const visibleEntityIds = [];
  for (const entity of entities) {
    const projected = projectPosition(
      entity.position,
      focusPosition,
      centerX,
      centerY,
      scale,
    );
    if (!projected.visible) continue;
    visibleEntityIds.push(entity.id);
    drawEntity(snapshotContext, entity, projected.x, projected.y);
  }

  const speed = focus ? vectorMagnitude(focus.velocity).toFixed(1) : "0.0";
  snapshotStatusEl.textContent =
    "rendered tick " +
    message.tick +
    " | focus " +
    (focus?.id ?? "none") +
    " | speed " +
    speed +
    " m/s | visible " +
    visibleEntityIds.join(", ");
}

function drawGrid(context, width, height) {
  context.strokeStyle = "#16211d";
  context.lineWidth = 1;
  for (let x = width % 80; x < width; x += 80) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = height % 80; y < height; y += 80) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function projectPosition(position, focusPosition, centerX, centerY, scale) {
  const dx = position.x - focusPosition.x;
  const dy = position.y - focusPosition.y;
  const x = centerX + signedLog(dx, 1_000_000) * scale;
  const y = centerY - signedLog(dy, 1_000_000) * scale;
  return {
    visible:
      x >= -40 &&
      x <= snapshotCanvas.width + 40 &&
      y >= -40 &&
      y <= snapshotCanvas.height + 40,
    x,
    y,
  };
}

function signedLog(value, divisor) {
  return Math.sign(value) * Math.log1p(Math.abs(value) / divisor);
}

function drawEntity(context, entity, x, y) {
  const isShip = entity.id.startsWith("ship:");
  const radius = entity.id === fields.entityId.value ? 6 : isShip ? 5 : 4;
  context.fillStyle = colorForEntity(entity.id);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#d7e6dc";
  context.font = "12px ui-sans-serif, system-ui";
  context.fillText(entity.id, x + 8, y - 8);
}

function colorForEntity(entityId) {
  if (entityId.includes("sun")) return "#ffd166";
  if (entityId.includes("earth")) return "#5eb1ff";
  if (entityId.includes("moon")) return "#c7cbd1";
  if (entityId === "ship:blue") return "#7db7ff";
  if (entityId === "ship:red") return "#ff6b6b";
  return "#d7f3de";
}

function vectorMagnitude(vector) {
  if (!vector) return 0;
  return Math.hypot(vector.x ?? 0, vector.y ?? 0, vector.z ?? 0);
}

function isFiniteVec3(value) {
  return (
    value &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

function isTextInputTarget(value) {
  return (
    value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    value instanceof HTMLSelectElement
  );
}

function nextSequence() {
  const value = sequence;
  sequence += 1;
  return value;
}

let currentLogList;
let currentLogListMaxDate;

const summaryFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  second: "2-digit",
  fractionalSecondDigits: 3,
});

function log(value) {
  const loggedValue =
    value.type === "snapshot"
      ? {
          type: value.type,
          gameId: value.gameId,
          sequence: value.sequence,
          tick: value.tick,
          entities: value.snapshot.entities.length,
        }
      : value;

  const newDate = new Date();

  if (!currentLogListMaxDate) {
    currentLogListMaxDate = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      newDate.getDate(),
      newDate.getHours(),
      newDate.getMinutes(),
    );
  }

  if (newDate > currentLogListMaxDate) {
    const summaryEl = document.createElement("summary");
    summaryEl.textContent = summaryFormatter.format(currentLogListMaxDate);
    currentLogList = document.createElement("ul");
    const detailsEl = document.createElement("details");
    detailsEl.appendChild(summaryEl);
    detailsEl.appendChild(currentLogList);
    const liEl = document.createElement("li");
    liEl.appendChild(detailsEl);
    logEl.appendChild(liEl);

    currentLogListMaxDate.setMinutes(currentLogListMaxDate.getMinutes() + 1);
  }

  const timeEl = document.createElement("span");
  timeEl.textContent = timeFormatter.format(newDate);
  const textEl = document.createElement("pre");
  textEl.textContent = JSON.stringify(loggedValue, null, 2);
  const subliEl = document.createElement("li");
  subliEl.append(timeEl);
  subliEl.append(textEl);

  currentLogList.appendChild(subliEl);
}
