import { ensureRedisConnection, redis } from "./redis";

export async function log(id: string, message: string){
    await ensureRedisConnection();
    const lines = message
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length === 0) {
        return;
    }
    await redis.rPush(`logs:${id}`, lines);
}

export async function setStatus(id: string, state: string, error?: string){
    await ensureRedisConnection();
    await redis.hSet(`status:${id}`, {
        state,
        ...(error ? {error} : {})
    });
}
