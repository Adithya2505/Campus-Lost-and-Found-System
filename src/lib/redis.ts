import { createClient } from "redis";
type RedisClient = ReturnType<typeof createClient>;
const state = globalThis as unknown as { campusRedis?: Promise<RedisClient> };
export async function redis() {
  if (!state.campusRedis) {
    state.campusRedis = (async () => {
      const client = createClient({
        url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        socket: { connectTimeout: 3000, reconnectStrategy: false },
      });
      client.on("error", () =>
        console.error(
          "Redis connection unavailable. Start the local services.",
        ),
      );
      await client.connect();
      return client;
    })().catch((error) => {
      state.campusRedis = undefined;
      throw error;
    });
  }
  const client = await state.campusRedis;
  if (!client.isReady) {
    state.campusRedis = undefined;
    return redis();
  }
  return client;
}
