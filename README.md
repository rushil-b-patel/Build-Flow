# Build Flow

Build Flow is a lightweight Vercel-style pipeline for static frontend deployments (Vite/React style apps).
You submit a GitHub repository URL, the system builds it, uploads artifacts, and serves it from a generated subdomain.

### What a user can do

1. Paste a GitHub repository URL in the frontend.
2. Click deploy.
3. Watch live status and build logs.
4. Open deployed output at `http://<deployment-id>.<deploy-domain>/index.html`.

### User-visible states

The UI can show:

- `cloning`
- `uploading`
- `queued`
- `building`
- `deployed`
- `error`

## Technical Architecture

### Services

- `frontend/`: React + Vite UI.
- `upload/`: API service for clone/upload/enqueue and status/log reads.
- `deploy/`: background worker that consumes queue jobs and builds.
- `request/`: serves deployed static files by subdomain.
- `redis`: queue + deployment metadata store.

### End-to-end flow

1. `POST /deploy` hits upload service.
2. Upload service generates an `id`, clones repo to `output/<id>`.
3. Upload service uploads source files to object storage under `output/<id>/...`.
4. Upload service sets status to `queued` and pushes `id` to Redis list `build-queue`.
5. Deploy worker downloads source from object storage.
6. Deploy worker runs:
   - `npm install`
   - `npm run build`
7. Deploy worker uploads built artifacts to `dist/<id>/...`.
8. Deploy worker sets status to `deployed` (or `error` on failure).
9. Request service serves files from `dist/<id><path>` using subdomain-derived `id`.

### Redis data model

- Queue:
  - `build-queue` (Redis list)
- Status:
  - `status:<id>` (Redis hash)
  - fields: `state`, optional `error`
- Logs:
  - `logs:<id>` (Redis list of lines)

## API Contract (Upload Service)

### `POST /deploy`

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
  "message": "..."
}
```

### `GET /status?id=<id>`

Response:

```json
{
  "status": {
    "state": "queued | building | deployed | error | ...",
    "error": "optional error message"
  }
}
```

Notes:

- Unknown IDs currently return an empty object: `{ "status": {} }`.

### `GET /logs?id=<id>`

Response:

```json
{
  "logs": ["line 1", "line 2"]
}
```

## Environment Variables

Create `.env` files in each service:

`upload/.env` & `deploy/.env` & `request/.env`

```bash
ACCESS_KEY_ID=...
SECRET_ACCESS_KEY=...
END_POINT=...
BUCKET_NAME=vercel
TOKEN_VALUE=...
```

`frontend/.env`

```bash
VITE_BASE_URL=http://localhost:3000
VITE_DEPLOY_URL=localhost:3001
```

Notes:

- `REDIS_URL` is set in `docker-compose.yml` for `upload` and `deploy`.
- `TOKEN_VALUE` exists in env files but is not used in current code.

## Local Development

### Docker

From repo root:

```bash
docker compose up --build
```

Services:

- Redis: `localhost:6380` -> container `6379`
- Upload API: `localhost:3000`
- Request service: `localhost:3001`
- Deploy worker: background

Frontend separately:

```bash
cd frontend
npm install
npm run dev
```

### Manual

Run Redis locally, then in separate terminals:

```bash
cd upload && npm install && npm run dev
cd deploy && npm install && npm run dev
cd request && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## Troubleshooting

### `GET /logs` returns 404

Most likely cause: running container has stale code.

Rebuild and recreate services:

```bash
docker compose up -d --build --force-recreate --no-deps upload deploy
```

Then verify:

```bash
curl -i "http://localhost:3000/logs?id=test"
```

### Deployment URL format

Frontend generates:

```text
http://<id>.<VITE_DEPLOY_URL>/index.html
```

With `VITE_DEPLOY_URL=localhost:3001`, example:

```text
http://abc123.localhost:3001/index.html
```

Your local DNS/routing must support this host pattern.
