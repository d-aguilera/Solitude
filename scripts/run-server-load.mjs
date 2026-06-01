#!/usr/bin/env node

import { parseArgs } from "node:util";
import { WebSocket } from "ws";

const {
  values: {
    clients: clientsArg,
    duration: durationArg,
    "input-hz": inputHzArg,
    "metrics-hz": metricsHzArg,
    url,
  },
} = parseArgs({
  options: {
    clients: { default: "8", type: "string" },
    duration: { default: "15", type: "string" },
    "input-hz": { default: "4", type: "string" },
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
    assignments.push({
      clientId,
      entityId: joined.entityId,
      nextInputSequence: 1,
      socket: sockets[index],
    });
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
      url,
    }),
  );

  await runLoad({
    durationMillis: durationSeconds * 1000,
    gameId,
    inputIntervalMillis: inputHz === 0 ? 0 : 1000 / inputHz,
    metricsIntervalMillis: 1000 / metricsHz,
  });
} finally {
  await Promise.allSettled(sockets.map((socket) => socket.close()));
}

async function runLoad({
  durationMillis,
  gameId,
  inputIntervalMillis,
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
      await Promise.all(
        assignments.map((assignment) =>
          sendClientMessage(assignment.socket, {
            clientId: assignment.clientId,
            controls: {
              burnForward: true,
              thrust5: true,
              yawLeft: inputPulse,
            },
            entityId: assignment.entityId,
            gameId,
            inputSequence: assignment.nextInputSequence++,
            sequence: requestId++,
            type: "input",
          }),
        ),
      );
      nextInputMillis += inputIntervalMillis;
    }

    if (now >= nextMetricsMillis) {
      const response = await fetch(`${url}/metrics`);
      console.log(JSON.stringify(await response.json()));
      nextMetricsMillis += metricsIntervalMillis;
    }

    await sleep(5);
  }

  const response = await fetch(`${url}/metrics`);
  console.log(JSON.stringify(await response.json()));
}

async function openSocket(socketUrl) {
  const socket = new WebSocket(socketUrl);
  const messages = [];
  const waiters = [];

  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString());
    messages.push(message);
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
