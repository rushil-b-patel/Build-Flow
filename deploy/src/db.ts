import { Pool } from "pg";
import { loadEnv } from "@shared/env";

loadEnv();

let pool: Pool | null = null;

function getPool(): Pool | null {
    if (!process.env.DATABASE_URL) {
        return null;
    };
    if (!pool) {
        pool = new Pool({ connectionString: process.env.DATABASE_URL });
    }
    return pool;
}

export async function updateDeploymentStatusInDB(
    id: string,
    status: string,
    error?: string
) {
    const p = getPool();
    if (!p) {
        return;
    };
    try {
        await p.query(
            `UPDATE deployments
                SET status = $1,
                    error = $2,
                    updated_at = NOW()
              WHERE id = $3`,
            [status, error || null, id]
        );
    } catch (err) {
        console.error("DB status update failed (non-fatal):", err);
    }
}
