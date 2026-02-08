import { createClient } from "redis";

export const redis = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});

let connection: Promise<void> | null = null;

export function ensureRedisConnection() {
    if (!connection) {
        connection = redis.connect().then(() => undefined);
    }
    return connection;
}
