import { createClient, type RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let connectionPromise: Promise<RedisClientType> | null = null;

export function getRedisClient(): RedisClientType {
    if (!redisClient) {
        redisClient = createClient({
            url: process.env.REDIS_URL || "redis://localhost:6379",
        });

        redisClient.on("error", (error) => {
            console.error("Redis error:", error);
        });
    }

    return redisClient;
}

export async function ensureRedisConnection(): Promise<RedisClientType> {
    const client = getRedisClient();
    if (client.isOpen) {
        return client;
    }

    if (!connectionPromise) {
        connectionPromise = client
            .connect()
            .then(() => client)
            .catch((error) => {
                connectionPromise = null;
                throw error;
            });
    }

    return connectionPromise;
}
