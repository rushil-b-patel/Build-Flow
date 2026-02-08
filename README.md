# Build Flow

Build Flow is a lightweight Vercel-style pipeline for static frontend deployments(Vite/React).
You submit a GitHub repository URL, the platform builds it, uploads the build output, and serves it from a generated subdomain.

### What the product does

Build Flow lets a user:

1. Paste a GitHub repository URL in the web UI.
2. Trigger deployment with one click.
3. Watch deployment state move from upload to build to deployed.
4. Open the deployed app at `http://<deployment-id>.<deploy-domain>/index.html`.

### End-user flow

1. The user enters a repo URL in the frontend (`frontend/src/App.tsx`).
2. Frontend calls `POST /deploy` on the upload service.
3. Frontend receives an `id` and polls `GET /status?id=<id>`.
4. When status becomes `deployed`, frontend renders the deployment URL.

### Functional scope

- Targets static web apps that produce a `dist/` folder.
- Assumes build command path: `npm install && npm run build`.
- Uses ID-based subdomain routing to map each deployment.
- Supports public GitHub repos (the code clones directly from repo URL).

### Functional constraints

- No authentication layer.
- No rollback/version management UI.
- No explicit failed status shown to users (status ends at `uploaded` or `deployed` in current flow).

### Monorepo structure

- `frontend/`: React + Vite deployment UI.
- `upload/`: API service that clones repos, uploads source files, and enqueues builds.
- `deploy/`: Worker that consumes queue jobs, builds projects, and publishes artifacts.
- `request/`: Static asset server for deployed artifacts via subdomain host lookup.
- `docker-compose.yml`: Local multi-service orchestration with Redis.

### Runtime architecture

1. `upload` receives deployment request.
2. `upload` clones repository to local `output/<id>`.
3. `upload` uploads all cloned files to S3-compatible storage under `output/<id>/...`.
4. `upload` pushes `<id>` into Redis list `build-queue` and writes status hash `status[<id>] = uploaded`.
5. `deploy` blocks on Redis `BRPOP build-queue`.
6. `deploy` downloads source from storage to local worker filesystem.
7. `deploy` runs `npm install && npm run build` in `output/<id>`.
8. `deploy` uploads `dist` files to storage under `dist/<id>/...`.
9. `deploy` updates Redis hash `status[<id>] = deployed`.
10. `request` serves files from storage using host-derived deployment ID.

### Service details

#### 1) Upload service (`upload/src/index.ts`)

- Listens on `:3000`.
- Endpoints:
  - `POST /deploy` body: `{ "repoUrl": "https://github.com/<owner>/<repo>" }`
  - `GET /status?id=<deployment-id>`
- Redis usage:
  - Queue: `build-queue` (list)
  - State: `status` (hash)

#### 2) Deploy worker (`deploy/src/index.ts`)

- No HTTP port; background worker.
- Continuously consumes jobs from Redis.
- Builds each project in isolated output folder under worker runtime.

#### 3) Request service (`request/src/index.ts`)

- Listens on `:3001`.
- Handles `GET /*`.
- Extracts deployment ID from hostname:
  - `<id>.<domain>` -> deployment ID = `<id>`
- Reads object storage key:
  - `dist/<id><request-path>`

#### 4) Frontend (`frontend/src/App.tsx`)

- Calls upload API using `VITE_BASE_URL`.
- Builds deployment link using `VITE_DEPLOY_URL`.
- Poll interval: 2 seconds.

### API contract

#### `POST /deploy` (Upload service)

Request:

```json
{
  "repoUrl": "https://github.com/user/repo"
}
```

Success response:

```json
{
  "id": "abc123",
  "files": ["..."]
}
```

Error response:

```json
{
  "message": "<error>"
}
```

#### `GET /status?id=<id>` (Upload service)

Response:

```json
{
  "status": "uploaded | deployed | null"
}
```

### Environment variables

Create `.env` files in each service folder.

`upload/.env`:

```bash
ACCESS_KEY_ID=...
SECRET_ACCESS_KEY=...
END_POINT=...
BUCKET_NAME=vercel
TOKEN_VALUE=...
```

`deploy/.env`:

```bash
ACCESS_KEY_ID=...
SECRET_ACCESS_KEY=...
END_POINT=...
BUCKET_NAME=vercel
TOKEN_VALUE=...
```

`request/.env`:

```bash
ACCESS_KEY_ID=...
SECRET_ACCESS_KEY=...
END_POINT=...
BUCKET_NAME=vercel
TOKEN_VALUE=...
```

`frontend/.env`:

```bash
VITE_BASE_URL=http://localhost:3000
VITE_DEPLOY_URL=localhost:3001
```

Notes:

- `REDIS_URL` is injected in `docker-compose.yml` for `upload` and `deploy`.
- `TOKEN_VALUE` exists in env files but is not currently used in code.
- `request` currently reads from hardcoded bucket `"vercel"` in source.

### Local development

#### Option A: Docker (recommended for backend services)

From repo root:

```bash
docker compose up --build
```

This starts:

- Redis on `localhost:6380` (container port `6379`)
- Upload API on `localhost:3000`
- Request server on `localhost:3001`
- Deploy worker in background

Then run frontend separately:

```bash
cd frontend
npm install
npm run dev
```

#### Option B: Run each service manually

Run Redis locally on `6379` (or set `REDIS_URL`).

In separate terminals:

```bash
cd upload && npm install && npm run dev
cd deploy && npm install && npm run dev
cd request && npm install && npm run dev
cd frontend && npm install && npm run dev
```

### Deployment URL behavior

Frontend generates URLs like:

```text
http://<id>.<VITE_DEPLOY_URL>/index.html
```

With `VITE_DEPLOY_URL=localhost:3001`, this becomes:

```text
http://<id>.localhost:3001/index.html
```

Ensure your local/network DNS and routing setup supports this host pattern.
