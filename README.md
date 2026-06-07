# Build Flow

A self-hosted deployment platform for static frontend applications. Submit a GitHub repository URL, and Build Flow clones, builds, and serves the resulting site on a unique subdomain similar to Vercel, but under your own infrastructure.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
  - [Services](#services)
  - [Shared Packages](#shared-packages)
  - [Deployment Lifecycle](#deployment-lifecycle)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
  - [Prerequisites](#prerequisites)
  - [Clone the Repository](#clone-the-repository)
  - [Environment Variables](#environment-variables)
  - [Run with Docker](#run-with-docker)
  - [Run without Docker](#run-without-docker)
  - [Build for Production](#build-for-production)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Deployments](#deployments)
  - [Logs and Status](#logs-and-status)
  - [GitHub](#github)
  - [Request Service](#request-service)
- [Redis Keys](#redis-keys)

## Overview

Build Flow takes a GitHub repository, builds the frontend, and hosts it on a subdomain you control.

Core features:

- GitHub OAuth login
- One-click deploy from a GitHub URL
- Real-time build logs via Server-Sent Events
- Custom subdomain per deployment
- Deployment history dashboard
- Redeploy and delete existing deployments

## Tech Stack

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | React 19, Vite 7, React Router, Tailwind CSS  |
| Backend     | Node.js 20, Express 4, TypeScript 5           |
| Database    | PostgreSQL 16                                 |
| Cache/Queue | Redis 7                                       |
| Storage     | Cloudflare R2 (S3-compatible)                 |
| Auth        | GitHub OAuth 2.0                              |
| Build       | tsc + tsc-alias (path alias resolution)       |
| Containers  | Docker, Docker Compose                        |

## Architecture

Build Flow is four services that talk through Redis (job queue) and S3-compatible storage (artifact transfer). PostgreSQL is the persistent store for deployment records.

```
                                +------------------+
                                |     Frontend     |
                                |  React / Vite    |
                                |    :5173 (dev)   |
                                +--------+---------+
                                         |
                          POST /deploy   | GET /logs/stream (SSE)
                                         v
                                +------------------+
                                |  Upload Service  |
                                |   Express :3000  |
                                +--------+---------+
                                         |
                       +-----------------+-----------------+
                       |                 |                 |
                       v                 v                 v
                  +----------+    +------------+    +-----------+
                  |   S3/R2  |    |   Redis    |    | PostgreSQL|
                  | (source) |    |  (queue +  |    | (records) |
                  +----------+    |   logs)    |    +-----------+
                       |          +-----+------+          |
                       v                |                 |
                +------------------+    |                 |
                |  Deploy Worker   |<---+  BRPOP          |
                |   Node.js        |--------------------------+
                +--------+---------+
                         |
                         v
                    +----------+
                    |   S3/R2  |
                    | (dist/)  |
                    +----+-----+
                         |
                         v
                +------------------+
                | Request Service  |
                |  Express :3001   |
                +------------------+
                         |
                         v
                  User's browser
```

### Services

- **Upload Service** (`upload/`, port `3000`): Receives deployment requests, clones the repository from GitHub, uploads source to S3 under `output/<id>/`, creates a database record, and enqueues a build job in Redis.
- **Deploy Worker** (`deploy/`): Polls the Redis `build-queue` with `BRPOP`. Downloads source from S3, runs `npm install && npm run build`, uploads the `dist/` output to S3 under `dist/<id>/`, and updates deployment status. Streams build logs to Redis for real-time consumption. Concurrency is configurable via `WORKER_CONCURRENCY`.
- **Request Service** (`request/`, port `3001`): Serves deployed sites. Resolves the subdomain (slug or deployment ID) to an S3 path, fetches the file, and returns it with the correct MIME type. Root paths default to `index.html`.
- **Frontend** (`frontend/`, port `5173` dev): React/Vite single-page application. Provides the deployment form, GitHub OAuth login, real-time build log streaming via SSE, and a deployment history dashboard.

### Shared Packages

- **`packages/backend-core`**: PostgreSQL queries (deployment CRUD), Redis operations (queue, sessions, logs, slug mapping), S3 client, and filesystem utilities. Used by all three backend services.
- **`packages/shared`**: TypeScript type definitions shared between frontend and backend: deployment states, auth types, GitHub URL parsing.

### Deployment Lifecycle

Each deployment transitions through these states:

```
cloning --> uploading --> queued --> building --> deployed
                                        |
                                        +-------> error
```

1. **cloning**: Upload service clones the GitHub repo (optionally a specific branch or commit).
2. **uploading**: Source tree is uploaded to S3 at `output/<deployment_id>/`.
3. **queued**: Build job is pushed to Redis `build-queue`.
4. **building**: Worker dequeues the job, installs dependencies, and runs the build. Logs stream into Redis.
5. **deployed**: Build artifacts are stored at `dist/<deployment_id>/` in S3. The site is live.
6. **error**: Build failed. Error message is stored in PostgreSQL and surfaced to the user.

## Project Structure

```
Build-Flow/
  frontend/              React/Vite dashboard
  upload/                Express API -- deployment intake, auth, logs
  deploy/                Build worker -- queue consumer, npm build runner
  request/               Express server -- serves deployed sites from S3
  packages/
    backend-core/        Shared backend: DB, Redis, S3, sessions, slugs
    shared/              Shared TypeScript types: deployment, auth, github
  docker-compose.yml     Local development orchestration
```

## Local Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 20+
- A GitHub OAuth application (for authentication)
- An S3-compatible storage bucket (Cloudflare R2, AWS S3, MinIO, etc.)

### Clone the Repository

```bash
git clone https://github.com/<your-org>/Build-Flow.git
cd Build-Flow
```

### Environment Variables

All services share a single central `.env` file at the repository root. Copy the
template and fill in your values:

```bash
cp .env.example .env
```

`.env` is the single source of truth for every service (`upload`, `deploy`,
`request`, and `frontend`) and is git-ignored. The committed `.env.example`
documents every variable.

```
# S3 / Cloudflare R2 (upload, deploy, request)
ACCESS_KEY_ID=<s3_access_key>
SECRET_ACCESS_KEY=<s3_secret_key>
END_POINT=<s3_endpoint_url>
BUCKET_NAME=<bucket_name>

# PostgreSQL (upload, deploy)
DATABASE_URL=postgres://buildflow:buildflow@localhost:5433/buildflow

# Redis (all backend services)
REDIS_URL=redis://localhost:6380

# GitHub OAuth (upload)
GITHUB_CLIENT_ID=<github_oauth_client_id>
GITHUB_CLIENT_SECRET=<github_oauth_client_secret>

# Frontend (Vite — must be VITE_-prefixed to reach the browser)
VITE_BASE_URL=http://localhost:3000
VITE_DEPLOY_URL=localhost:3001
VITE_GITHUB_CLIENT_ID=<github_oauth_client_id>
```

How the central file is consumed:

- **Docker**: `docker-compose.yml` loads `.env` into every service via `env_file`.
  `DATABASE_URL` and `REDIS_URL` are overridden per-service in the compose file
  with the in-network hostnames (`postgres:5432`, `redis:6379`), so the
  `localhost` values above are used only for local (non-Docker) runs.
- **Local (no Docker)**: the backend services load the root file through
  `DOTENV_CONFIG_PATH=../.env` (set in each service's `dev`/`start` script), and
  the frontend reads it because Vite's `envDir` points at the repository root.

Optional variables:

- `GITHUB_TOKEN` — Personal access token for higher GitHub API rate limits
- `WORKER_CONCURRENCY` — Number of concurrent build workers (default: 1)
- `WORKER_BRPOP_TIMEOUT_SEC` — Queue poll timeout in seconds (default: 5)
- `SESSION_TTL_SECONDS` — Session expiry (default: 604800 / 7 days)

### Run with Docker

A single command builds and starts the entire stack — Redis, PostgreSQL, the
upload service, deploy worker, request service, **and the frontend**:

```bash
docker compose up --build
```

| Service   | URL / Port              |
|-----------|-------------------------|
| Frontend  | http://localhost:5173   |
| Upload    | http://localhost:3000   |
| Request   | http://localhost:3001   |
| PostgreSQL| localhost:5433          |
| Redis     | localhost:6380          |

The frontend runs the Vite dev server with hot reload; `frontend/` and
`packages/` are bind-mounted into the container, so source edits are picked up
live.

### Run without Docker

Start Redis and PostgreSQL independently, then run each service. All services
read the central root `.env` automatically:

```bash
# Terminal 1 -- Upload service
cd upload && npm install && npm run dev

# Terminal 2 -- Deploy worker
cd deploy && npm install && npm run dev

# Terminal 3 -- Request service
cd request && npm install && npm run dev

# Terminal 4 -- Frontend
cd frontend && npm install && npm run dev
```

### Build for Production

Each backend service compiles TypeScript and resolves path aliases:

```bash
cd <service>
npm run build    # tsc && tsc-alias
npm start        # node dist/<service>/src/index.js
```

## API Reference

### Authentication

| Method | Endpoint                | Auth     | Description                            |
|--------|-------------------------|----------|----------------------------------------|
| GET    | `/auth/github`          | No       | Returns GitHub OAuth authorization URL |
| GET    | `/auth/github/callback` | No       | OAuth callback, sets session cookie    |
| GET    | `/auth/me`              | Required | Returns authenticated user profile     |
| POST   | `/auth/logout`          | Required | Clears session                         |

### Deployments

| Method | Endpoint        | Auth     | Description                                                        |
|--------|-----------------|----------|--------------------------------------------------------------------|
| POST   | `/deploy`       | Optional | Create deployment. Body: `{ repoUrl, branch?, commitSha?, slug? }` |
| POST   | `/redeploy/:id` | Required | Redeploy an existing deployment                                    |
| GET    | `/deployments`  | Required | List user's deployments (latest 10)                                |

### Logs and Status

| Method | Endpoint               | Auth | Description                                |
|--------|------------------------|------|--------------------------------------------|
| GET    | `/logs?id=<id>`        | No   | Retrieve all log lines for a deployment    |
| GET    | `/logs/stream?id=<id>` | No   | SSE stream of logs and status updates      |
| GET    | `/status?id=<id>`      | No   | Current deployment state                   |

### GitHub

| Method | Endpoint                         | Auth     | Description                    |
|--------|----------------------------------|----------|--------------------------------|
| GET    | `/github/branches?repoUrl=<url>` | Optional | List branches for a repository |

### Request Service

Port 3001. All requests are routed by subdomain: `<slug_or_id>.localhost:3001/<path>`. The service resolves the subdomain to a deployment ID, fetches the corresponding file from S3, and serves it.

## Redis Keys

| Key Pattern       | Type   | Purpose                                        |
|-------------------|--------|------------------------------------------------|
| `build-queue`     | List   | Job queue (LPUSH to enqueue, BRPOP to dequeue) |
| `logs:<id>`       | List   | Build log lines for a deployment               |
| `status:<id>`     | Hash   | Deployment state mirror for SSE delivery       |
| `session:<token>` | String | Session payload (JSON), 7-day TTL              |
| `bf:slug:<slug>`  | String | Slug to deployment ID mapping                  |
| `bf:id-slug:<id>` | String | Deployment ID to slug reverse mapping          |
