import { ensureRedisConnection } from "./redis-connection";

function normalizeLogLines(message: string): string[] {
    return message
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

export async function appendDeploymentLog(
    deploymentId: string,
    message: string,
) {
    const lines = normalizeLogLines(message);
    if (lines.length === 0) {
        return;
    }

    const redis = await ensureRedisConnection();
    await redis.rPush(`logs:${deploymentId}`, lines);
}

export async function getDeploymentLogs(deploymentId: string) {
    const redis = await ensureRedisConnection();
    return redis.lRange(`logs:${deploymentId}`, 0, -1);
}
