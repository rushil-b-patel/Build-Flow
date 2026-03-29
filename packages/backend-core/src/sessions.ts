import crypto from "crypto";
import type { SessionPayload } from "@packages/shared/auth";
import { ensureRedisConnection } from "./redis-connection";

export const SESSION_COOKIE_NAME = "bf_session";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSessionTtlSeconds() {
    const ttl = Number(process.env.SESSION_TTL_SECONDS);
    if (Number.isFinite(ttl) && ttl > 0) {
        return ttl;
    }
    return DEFAULT_SESSION_TTL_SECONDS;
}

function getSessionKey(sessionToken: string) {
    return `session:${sessionToken}`;
}

export async function createSession(payload: SessionPayload) {
    const sessionToken = crypto.randomBytes(32).toString("base64url");
    const redis = await ensureRedisConnection();
    await redis.set(getSessionKey(sessionToken), JSON.stringify(payload), {
        EX: getSessionTtlSeconds(),
    });
    return sessionToken;
}

export async function getSession(sessionToken: string) {
    const redis = await ensureRedisConnection();
    const raw = await redis.get(getSessionKey(sessionToken));
    if (!raw) {
        return null;
    }
    await redis.expire(getSessionKey(sessionToken), getSessionTtlSeconds());
    return JSON.parse(raw) as SessionPayload;
}

export async function deleteSession(sessionToken: string) {
    const redis = await ensureRedisConnection();
    await redis.del(getSessionKey(sessionToken));
}
