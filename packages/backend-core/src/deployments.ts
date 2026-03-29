import { Pool } from "pg";
import {
    deploymentStates,
    isDeploymentState,
    type DeploymentState,
    type DeploymentStatusPayload,
} from "@packages/shared/deployment";
import { ensureRedisConnection } from "./redis-connection";

/** Mirrors Postgres status into Redis for SSE (`/logs/stream` reads `status:${id}`). */
async function mirrorDeploymentStatusToRedis(
    id: string,
    state: DeploymentState,
) {
    try {
        const redis = await ensureRedisConnection();
        await redis.hSet(`status:${id}`, { state });
    } catch (err) {
        console.error("Failed to mirror deployment status to Redis", err);
    }
}

export interface DeploymentRecord {
    id: string;
    repo_url: string;
    status: DeploymentState;
    error: string | null;
    created_at: string;
    updated_at: string;
    github_user: string | null;
}

interface DeploymentRow {
    id: string;
    repo_url: string;
    status: string;
    error: string | null;
    created_at: string;
    updated_at: string;
    github_user: string | null;
}

let pool: Pool | null = null;

function getPool(): Pool {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required");
    }

    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
    }

    return pool;
}

function mapDeploymentRow(row: DeploymentRow): DeploymentRecord {
    if (!isDeploymentState(row.status)) {
        throw new Error(`Invalid deployment state in database: ${row.status}`);
    }

    return {
        ...row,
        status: row.status,
    };
}

export async function initDeploymentStore() {
    const pool = getPool();
    const allowedStates = deploymentStates
        .map((state) => `'${state}'`)
        .join(", ");

    await pool.query(`
    CREATE TABLE IF NOT EXISTS deployments (
      id          TEXT PRIMARY KEY,
      repo_url    TEXT NOT NULL,
      status      TEXT NOT NULL CHECK (status IN (${allowedStates})),
      error       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      github_user TEXT
    );
  `);
}

export async function createDeployment(
    id: string,
    repoUrl: string,
    githubUser?: string,
) {
    await getPool().query(
        `INSERT INTO deployments (id, repo_url, status, github_user)
     VALUES ($1, $2, $3, $4)`,
        [id, repoUrl, "cloning", githubUser || null],
    );
    await mirrorDeploymentStatusToRedis(id, "cloning");
}

export async function updateDeploymentState(
    id: string,
    status: DeploymentState,
    error?: string,
) {
    await getPool().query(
        `UPDATE deployments
        SET status = $1,
            error = $2,
            updated_at = NOW()
      WHERE id = $3`,
        [status, error ?? null, id],
    );
    await mirrorDeploymentStatusToRedis(id, status);
}

export async function getDeploymentStatus(
    id: string,
): Promise<DeploymentStatusPayload> {
    const result = await getPool().query<
        Pick<DeploymentRow, "status" | "error">
    >(
        `SELECT status, error
       FROM deployments
      WHERE id = $1`,
        [id],
    );

    if (result.rows.length === 0) {
        return {};
    }

    const row = result.rows[0];
    if (!isDeploymentState(row.status)) {
        throw new Error(`Invalid deployment state in database: ${row.status}`);
    }

    return {
        state: row.status,
        error: row.error,
    };
}

export async function listDeployments(githubUser?: string) {
    if (githubUser) {
        const result = await getPool().query<DeploymentRow>(
            `SELECT id, repo_url, status, error, created_at, updated_at, github_user
         FROM deployments
        WHERE github_user = $1
        ORDER BY created_at DESC
        LIMIT 10`,
            [githubUser],
        );

        return result.rows.map(mapDeploymentRow);
    }

    const result = await getPool().query<DeploymentRow>(
        `SELECT id, repo_url, status, error, created_at, updated_at, github_user
       FROM deployments
      ORDER BY created_at DESC
      LIMIT 10`,
    );

    return result.rows.map(mapDeploymentRow);
}
