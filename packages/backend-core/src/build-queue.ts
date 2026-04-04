import { commandOptions } from "redis";
import { ensureRedisConnection } from "./redis-connection";

const BUILD_QUEUE_KEY = "build-queue";

export async function enqueueBuild(deploymentId: string) {
    const redis = await ensureRedisConnection();
    await redis.lPush(BUILD_QUEUE_KEY, deploymentId);
}

/** @param timeoutSeconds 0 = block indefinitely (use sparingly; prefer timeout for shutdown loops) */
export async function dequeueBuild(timeoutSeconds = 0): Promise<string | null> {
    const redis = await ensureRedisConnection();
    const response = await redis.brPop(
        commandOptions({ isolated: true }),
        BUILD_QUEUE_KEY,
        timeoutSeconds,
    );

    return response?.element ?? null;
}
