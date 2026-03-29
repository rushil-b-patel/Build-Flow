import { ensureRedisConnection } from "./redis-connection";

const SLUG_TO_ID = "bf:slug:";
const ID_TO_SLUG = "bf:id-slug:";

const RESERVED_SLUGS = new Set([
    "www",
    "api",
    "mail",
    "ftp",
    "localhost",
    "admin",
]);

export function normalizeSlug(raw: string): string {
    return raw.trim().toLowerCase();
}

export function isValidSlug(normalized: string): boolean {
    if (normalized.length < 2 || normalized.length > 63) {
        return false;
    }
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
        return false;
    }
    if (RESERVED_SLUGS.has(normalized)) {
        return false;
    }
    return true;
}

/** Atomically reserve slug → deployment id. Returns false if slug is taken. */
export async function tryReserveSlug(
    slug: string,
    deploymentId: string,
): Promise<boolean> {
    const redis = await ensureRedisConnection();
    const key = `${SLUG_TO_ID}${slug}`;
    const result = await redis.set(key, deploymentId, { NX: true });
    if (result !== "OK") {
        return false;
    }
    await redis.set(`${ID_TO_SLUG}${deploymentId}`, slug);
    return true;
}

export async function releaseSlugReservation(
    slug: string,
    deploymentId: string,
): Promise<void> {
    const redis = await ensureRedisConnection();
    const key = `${SLUG_TO_ID}${slug}`;
    const current = await redis.get(key);
    if (current === deploymentId) {
        await redis.del(key);
        await redis.del(`${ID_TO_SLUG}${deploymentId}`);
    }
}

export async function getDeploymentIdBySlug(
    slug: string,
): Promise<string | null> {
    const normalized = normalizeSlug(slug);
    if (!normalized || !isValidSlug(normalized)) {
        return null;
    }
    const redis = await ensureRedisConnection();
    const id = await redis.get(`${SLUG_TO_ID}${normalized}`);
    return id;
}

export async function getSlugForDeploymentId(
    deploymentId: string,
): Promise<string | null> {
    const redis = await ensureRedisConnection();
    return redis.get(`${ID_TO_SLUG}${deploymentId}`);
}
