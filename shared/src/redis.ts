const { createClient } = require("redis");

type RedisClient = any;

const connectionCache = new WeakMap<RedisClient, Promise<void>>();

export function createRedisConnection(url = process.env.REDIS_URL || "redis://localhost:6379") {
  return createClient({ url });
}

export function ensureRedisConnection(client: RedisClient) {
  const existingConnection = connectionCache.get(client);
  if (existingConnection) {
    return existingConnection;
  }

  const connection = client.connect().then(() => undefined);
  connectionCache.set(client, connection);
  return connection;
}
