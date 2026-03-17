import {
    createRedisConnection,
    ensureRedisConnection as ensureSharedRedisConnection,
} from "@shared/redis";
import { loadEnv } from "@shared/env";

loadEnv();

export const redis = createRedisConnection();

export function ensureRedisConnection() {
    return ensureSharedRedisConnection(redis);
}
