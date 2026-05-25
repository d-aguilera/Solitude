let sequence = 1;
let events = null;
let runActive = false;
let engineRenderer = null;

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
  simulationStepMillis: document.querySelector("#simulationStepMillis"),
  runIntervalMillis: document.querySelector("#runIntervalMillis"),
};
const gamesListEl = document.querySelector("#gamesList");
const logEl = document.querySelector("#log");
const keyStatusEl = document.querySelector("#keyStatus");
const snapshotCanvas = document.querySelector("#snapshotCanvas");
const snapshotContext = snapshotCanvas.getContext("2d");
const snapshotStatusEl = document.querySelector("#snapshotStatus");
const statusEl = document.querySelector("#status");
const runStatusEl = document.querySelector("#runStatus");
const toggleRunButton = document.querySelector("#toggleRun");

void import("/src/remoteProbeRenderer.ts").then((module) => {
  engineRenderer = module.createSolitudeRemoteProbeRenderer({
    canvas: snapshotCanvas,
    getFocusEntityId: () => fields.entityId.value,
    statusElement: snapshotStatusEl,
  });
});

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

document.querySelector("#refreshGames").addEventListener("click", () => {
  void refreshGames();
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
  void refreshGames();
}

async function refreshGames() {
  const response = await fetch("/games");
  const payload = await response.json();
  renderGames(payload.games ?? []);
}

function renderGames(games) {
  gamesListEl.textContent = "";
  if (games.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "game-summary";
    emptyItem.textContent = "No games yet";
    gamesListEl.appendChild(emptyItem);
    return;
  }
  for (const game of games) {
    const item = document.createElement("li");
    item.className = "game-row";

    const summary = document.createElement("div");
    summary.className = "game-summary";
    summary.textContent =
      game.gameId +
      " | tick " +
      game.tick +
      " | assigned " +
      formatEntityList(game.assignedEntityIds) +
      " | available " +
      formatEntityList(game.availableEntityIds);

    const joinButton = document.createElement("button");
    joinButton.className = "secondary";
    joinButton.textContent = "Join";
    joinButton.disabled = game.availableEntityIds.length === 0;
    joinButton.addEventListener("click", () => {
      fields.gameId.value = game.gameId;
      sendMessage({
        type: "joinGame",
        clientId: fields.clientId.value,
        gameId: game.gameId,
        sequence: nextSequence(),
      });
    });

    item.append(summary, joinButton);
    gamesListEl.appendChild(item);
  }
}

function formatEntityList(entityIds) {
  return entityIds.length === 0 ? "none" : entityIds.join(", ");
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

  const dtMillis = Math.max(1, Number(fields.dtMillis.value) || 250);
  fields.dtMillis.value = String(dtMillis);

  const simulationStepMillis = Math.max(
    1,
    Number(fields.simulationStepMillis.value) || 25,
  );
  fields.simulationStepMillis.value = String(simulationStepMillis);

  const response = await fetch("/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: fields.gameId.value,
      dtMillis,
      intervalMillis,
      simulationStepMillis,
    }),
  });

  const payload = await response.json();

  handleMessages(payload.messages);

  runActive = true;

  runStatusEl.textContent = [
    "Server running every",
    intervalMillis,
    "ms at broadcast dt",
    dtMillis,
    "ms, sim step",
    simulationStepMillis,
    "ms",
  ].join(" ");

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
    switch (message.type) {
      case "gameCreated":
        fields.gameId.value = message.gameId;
        break;
      case "joined":
        fields.gameId.value = message.gameId;
        fields.entityId.value = message.entityId;
        if (options.connectAfterJoin) connectEvents();
        break;
      case "snapshot":
        engineRenderer.renderSnapshotMessage(message);
        if (!options.suppressSnapshots) {
          statusEl.textContent = [
            "tick",
            message.tick,
            "| entities",
            message.snapshot.entities.length,
          ].join(" ");
        }
        break;
    }
    log(message);
  }
}

function isTextInputTarget(value) {
  return (
    value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    value instanceof HTMLSelectElement
  );
}

function nextSequence() {
  // return current value, then increment for next call
  return sequence++;
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
