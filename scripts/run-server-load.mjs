#!/usr/bin/env node

import { parseArgs } from "node:util";
import { WebSocket } from "ws";

const {
  values: {
    clients: clientsArg,
    duration: durationArg,
    "input-hz": inputHzArg,
    latency,
    "metrics-hz": metricsHzArg,
    url,
  },
} = parseArgs({
  options: {
    clients: { default: "8", type: "string" },
    duration: { default: "15", type: "string" },
    "input-hz": { default: "4", type: "string" },
    latency: { default: false, type: "boolean" },
    "metrics-hz": { default: "1", type: "string" },
    url: { default: "http://127.0.0.1:8787", type: "string" },
  },
});

const clients = parsePositiveInteger(clientsArg, "clients");
const durationSeconds = parsePositiveNumber(durationArg, "duration");
const inputHz = parseNonNegativeNumber(inputHzArg, "input-hz");
const metricsHz = parsePositiveNumber(metricsHzArg, "metrics-hz");

const sockets = [];
const assignments = [];
const latencyTracker = createInputLatencyTracker();
let requestId = 1;

try {
  for (let index = 0; index < clients; index++) {
    sockets.push(await openSocket(`${url.replace(/^http/, "ws")}/socket`));
  }

  const createResponse = await sendClientMessage(sockets[0], {
    clientId: "load-client:1",
    sequence: requestId++,
    type: "createGame",
  });
  const created = createResponse.messages.find(
    (message) => message.type === "gameCreated",
  );
  if (!created) {
    throw new Error(`Failed to create game: ${JSON.stringify(createResponse)}`);
  }
  const gameId = created.gameId;

  for (let index = 0; index < sockets.length; index++) {
    const clientId = `load-client:${index + 1}`;
    const response = await sendClientMessage(sockets[index], {
      clientId,
      gameId,
      sequence: requestId++,
      type: "joinGame",
    });
    const joined = response.messages.find(
      (message) => message.type === "joined",
    );
    if (!joined) {
      throw new Error(
        `Client ${clientId} failed to join: ${JSON.stringify(response)}`,
      );
    }
    const assignment = {
      clientId,
      entityId: joined.entityId,
      nextInputSequence: 1,
      pendingInputs: [],
      socket: sockets[index],
    };
    assignment.socket.observe((message) => {
      latencyTracker.recordSocketMessage(assignment, message, Date.now());
    });
    assignments.push(assignment);
  }

  console.log(
    JSON.stringify({
      assignments: assignments.map(({ clientId, entityId }) => ({
        clientId,
        entityId,
      })),
      clients,
      durationSeconds,
      gameId,
      inputHz,
      latency,
      url,
    }),
  );

  await runLoad({
    durationMillis: durationSeconds * 1000,
    gameId,
    inputIntervalMillis: inputHz === 0 ? 0 : 1000 / inputHz,
    latency,
    metricsIntervalMillis: 1000 / metricsHz,
  });
} finally {
  await Promise.allSettled(sockets.map((socket) => socket.close()));
}

async function runLoad({
  durationMillis,
  gameId,
  inputIntervalMillis,
  latency,
  metricsIntervalMillis,
}) {
  const endMillis = Date.now() + durationMillis;
  let nextInputMillis = Date.now();
  let nextMetricsMillis = Date.now();
  let inputPulse = false;

  while (Date.now() < endMillis) {
    const now = Date.now();

    if (inputIntervalMillis > 0 && now >= nextInputMillis) {
      inputPulse = !inputPulse;
      for (const assignment of assignments) {
        const inputSequence = assignment.nextInputSequence++;
        latencyTracker.recordInputSent(assignment, inputSequence, Date.now());
        sendClientMessageEvent(assignment.socket, {
          clientId: assignment.clientId,
          controls: {
            burnForward: true,
            thrust5: true,
            yawLeft: inputPulse,
          },
          entityId: assignment.entityId,
          gameId,
          inputSequence,
          sequence: requestId++,
          type: "input",
        });
      }
      nextInputMillis += inputIntervalMillis;
    }

    if (now >= nextMetricsMillis) {
      const response = await fetch(`${url}/metrics`);
      console.log(JSON.stringify(await response.json()));
      if (latency) console.log(JSON.stringify(latencyTracker.takeReport()));
      nextMetricsMillis += metricsIntervalMillis;
    }

    await sleep(5);
  }

  const response = await fetch(`${url}/metrics`);
  console.log(JSON.stringify(await response.json()));
  if (latency) console.log(JSON.stringify(latencyTracker.takeReport()));
}

async function openSocket(socketUrl) {
  const socket = new WebSocket(socketUrl);
  const messages = [];
  const observers = [];
  const waiters = [];

  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString());
    messages.push(message);
    for (const observer of observers) observer(message);
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      if (waiter.predicate(message)) {
        waiters.splice(index, 1);
        waiter.resolve(message);
      }
    }
  });

  return {
    close: () =>
      new Promise((resolve) => {
        if (
          socket.readyState === WebSocket.CLOSED ||
          socket.readyState === WebSocket.CLOSING
        ) {
          resolve();
          return;
        }
        socket.once("close", resolve);
        socket.close();
      }),
    observe: (observer) => {
      observers.push(observer);
    },
    readUntil: (predicate) => {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve) => {
        waiters.push({ predicate, resolve });
      });
    },
    send: (payload) => {
      socket.send(JSON.stringify(payload));
    },
  };
}

async function sendClientMessage(socket, message) {
  const currentRequestId = message.sequence;
  const response = socket.readUntil(
    (item) => item.type === "messages" && item.requestId === currentRequestId,
  );
  socket.send({
    message,
    requestId: currentRequestId,
    type: "clientMessage",
  });
  return response;
}

function sendClientMessageEvent(socket, message) {
  socket.send({
    message,
    type: "clientMessageEvent",
  });
}

function createInputLatencyTracker() {
  const ackLatencies = [];
  const snapshotInterArrivalMillis = [];

  return {
    recordInputSent: (assignment, inputSequence, sentAtMillis) => {
      assignment.pendingInputs.push({ inputSequence, sentAtMillis });
    },
    recordSocketMessage: (assignment, message, receivedAtMillis) => {
      if (
        message.type !== "serverMessage" ||
        message.message?.type !== "snapshot"
      ) {
        return;
      }
      if (assignment.lastSnapshotReceivedAtMillis !== undefined) {
        snapshotInterArrivalMillis.push(
          receivedAtMillis - assignment.lastSnapshotReceivedAtMillis,
        );
      }
      assignment.lastSnapshotReceivedAtMillis = receivedAtMillis;

      const lastProcessedInputSequence =
        message.message.lastProcessedInputSequences[assignment.entityId] ?? 0;
      if (lastProcessedInputSequence <= 0) return;

      let writeIndex = 0;
      for (
        let readIndex = 0;
        readIndex < assignment.pendingInputs.length;
        readIndex++
      ) {
        const input = assignment.pendingInputs[readIndex];
        if (input.inputSequence <= lastProcessedInputSequence) {
          ackLatencies.push(receivedAtMillis - input.sentAtMillis);
        } else {
          assignment.pendingInputs[writeIndex] = input;
          writeIndex++;
        }
      }
      assignment.pendingInputs.length = writeIndex;
    },
    takeReport: () => {
      const report = {
        inputAckLatencyMillis: summarizeLatencies(ackLatencies),
        pendingInputAcks: assignments.reduce(
          (total, assignment) => total + assignment.pendingInputs.length,
          0,
        ),
        snapshotInterArrivalMillis: summarizeLatencies(
          snapshotInterArrivalMillis,
        ),
        type: "inputLatency",
      };
      ackLatencies.length = 0;
      snapshotInterArrivalMillis.length = 0;
      return report;
    },
  };
}

function summarizeLatencies(latencies) {
  if (latencies.length === 0) {
    return {
      avg: 0,
      count: 0,
      max: 0,
      p50: 0,
      p95: 0,
    };
  }

  const sorted = [...latencies].sort((left, right) => left - right);
  return {
    avg: sorted.reduce((total, value) => total + value, 0) / sorted.length,
    count: sorted.length,
    max: sorted[sorted.length - 1],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
  };
}

function percentile(sortedValues, rank) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil(sortedValues.length * rank) - 1,
  );
  return sortedValues[index];
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function parsePositiveNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number`);
  }
  return parsed;
}

function parseNonNegativeNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative number`);
  }
  return parsed;
}

function sleep(durationMillis) {
  return new Promise((resolve) => setTimeout(resolve, durationMillis));
}
