import { createServer } from "vite";

const host = "0.0.0.0";
const port = 4174;
const localUrl = `http://localhost:${port}/`;

let stopping = false;

const server = await createServer({
  clearScreen: false,
  plugins: [
    {
      name: "architecture-map-shutdown",
      configureServer(server) {
        server.middlewares.use("/__shutdown", (_request, response) => {
          response.statusCode = 204;
          response.end();
          setTimeout(() => {
            void stop(0);
          }, 0);
        });
      },
    },
  ],
  root: "docs/architecture-map",
  server: {
    host,
    port,
    strictPort: true,
  },
});

async function stop(exitCode) {
  if (stopping) {
    return;
  }

  stopping = true;
  await server.close();
  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void stop(0);
});

process.on("SIGTERM", () => {
  void stop(0);
});

console.log("Architecture map starting");
await server.listen();
console.log(`Architecture map ready at ${localUrl}`);
