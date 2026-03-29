import { commandOptions } from "redis";
import { ensureRedisConnection } from "./redis-connection";

const BUILD_QUEUE_KEY = "build-queue";

export async function enqueueBuild(deploymentId: string) {
    const redis = await ensureRedisConnection();
    await redis.lPush(BUILD_QUEUE_KEY, deploymentId);
}

export async function dequeueBuild(): Promise<string | null> {
    const redis = await ensureRedisConnection();
    const response = await redis.brPop(
        commandOptions({ isolated: true }),
        BUILD_QUEUE_KEY,
        0,
    );

    return response?.element ?? null;
}
