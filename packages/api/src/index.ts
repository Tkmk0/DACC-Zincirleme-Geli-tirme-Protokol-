import { env, createLogger } from "@dacc/core";
import { buildServer } from "./server.js";

const log = createLogger("api");

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  log.info({ port: env.API_PORT }, "DACC API server started");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
