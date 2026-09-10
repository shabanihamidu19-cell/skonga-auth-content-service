# SKONGA Auth–Content Service

**Source of truth** for identity, content ownership, usage quotas, and entitlements.

Does **not** call Groq/OpenAI/RAG — that stays on **skonga-backend-v2**.

```
SKONGA App ──JWT──► auth-content-service (users, content, quotas, Pro)
                └──► skonga-backend-v2 (AI + Library RAG + payments)
                         ├── usage check/record
                         └── Pro grant sync after paid STK
```

## Quick start

```bash
git clone https://github.com/shabanihamidu19-cell/skonga-auth-content-service.git
cd skonga-auth-content-service
cp .env.example .env
npm install
npm start
# → http://localhost:4000/health
# → http://localhost:4000/admin
```

## API

### Auth / Content / Usage
See prior sections — JWT for users; actions: `chat` · `scan` · `image_generation` · `rag_query` · `file_analysis`.

### Admin
- UI: `GET /admin` (paste `SERVICE_TOKEN`)
- `GET /api/admin/analytics/*` — overview, growth, usage, retention

### Internal (X-Service-Token) — Phase 4 Pro sync

```http
POST /api/internal/pro/grant
{ "userId": "...", "days": 30, "planId": "month", "expiresAt": 1735689600000, "orderId": "SK..." }

GET /api/internal/pro/status?userId=...
```

Called by **skonga-backend-v2** after successful payment when `uid` is on the order. Updates `subscriptions` so quota checks see Pro.

Also:
- `POST /api/internal/usage/record`
- `GET /api/internal/usage/check`

## Security
1. JWT for end users
2. `X-Service-Token` for backend ↔ auth-content
3. Quota exceeded → `403` + `QUOTA_EXCEEDED`

## Stack
Node 18+ · Express · SQLite or Postgres (`DATABASE_URL`) · JWT · bcryptjs

## Deploy (Render)
Env: `JWT_SECRET`, `SERVICE_TOKEN`, `DATABASE_URL`, `PORT`
