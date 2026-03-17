import { Pool } from "pg";
import { loadEnv } from "@shared/env";

loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deployments (
      id          TEXT PRIMARY KEY,
      repo_url    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'cloning',
      error       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      github_user TEXT
    );
  `);
}

export async function insertDeployment(
  id: string,
  repoUrl: string,
  githubUser?: string
) {
  await pool.query(
    `INSERT INTO deployments (id, repo_url, status, github_user)
     VALUES ($1, $2, 'cloning', $3)`,
    [id, repoUrl, githubUser || null]
  );
}

export async function updateDeploymentStatus(
  id: string,
  status: string,
  error?: string
) {
  await pool.query(
    `UPDATE deployments
        SET status = $1,
            error = $2,
            updated_at = NOW()
      WHERE id = $3`,
    [status, error || null, id]
  );
}

export async function getDeployments(githubUser?: string) {
  if (githubUser) {
    const result = await pool.query(
      `SELECT id, repo_url, status, error, created_at, updated_at, github_user
         FROM deployments
        WHERE github_user = $1
        ORDER BY created_at DESC
        LIMIT 10`,
      [githubUser]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT id, repo_url, status, error, created_at, updated_at, github_user
       FROM deployments
      ORDER BY created_at DESC
      LIMIT 10`
  );
  return result.rows;
}

export { pool };
