import fp from "fastify-plugin";
import { createRedisClient, env } from "@dacc/core";
import type { FastifyPluginAsync } from "fastify";

type RedisClient = ReturnType<typeof createRedisClient>;

declare module "fastify" {
  interface FastifyInstance {
    redis: RedisClient;
  }
}

const redisPlugin: FastifyPluginAsync = async (app) => {
  const redis = createRedisClient(env.REDIS_URL);
  app.decorate("redis", redis);
  app.addHook("onClose", async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin, { name: "redis" });
export { redisPlugin };
