# SKONGA Auth–Content Service

**Source of truth** for identity, content ownership, usage quotas, and entitlements.

Does **not** call Groq/OpenAI/RAG — that stays on **skonga-backend-v2**.

```
SKONGA App ──JWT──► auth-content-service (users, content, quotas)
                └──► skonga-backend-v2 (AI + Library RAG)
                         └── may call GET /usage/check before AI
```

## Quick start

```bash
git clone https://github.com/shabanihamidu19-cell/skonga-auth-content-service.git
cd skonga-auth-content-service
cp .env.example .env
# JWT_SECRET=$(openssl rand -hex 32)
npm install
npm start
# → http://localhost:4000/health
```

## API

### Auth
- `POST /auth/signup` `{ email, password, name? }` → `{ user, token }`
- `POST /auth/login` `{ email, password }` → `{ user, token }`
- `GET /auth/me` `Authorization: Bearer <JWT>`
- `POST /auth/logout`

### Content (JWT required)
- `POST /content` · `GET /content` · `GET /content/:id` · `DELETE /content/:id`
- `POST /content/upload` multipart `file`

### Usage (JWT required)
- `GET /usage` — entitlement + today quotas
- `GET /usage/check?action=chat` — allow/deny before AI
- `POST /usage/record` `{ action, units? }` — after successful AI

**Actions:** `chat` · `scan` · `image_generation` · `rag_query` · `file_analysis`

### Admin (X-Service-Token)
- `GET /api/admin/users` — list users + plan
- `GET /api/admin/stats` — user count
- `GET /api/admin/analytics/overview` — **Phase 1 product analytics**

```bash
curl -s -H "X-Service-Token: $SERVICE_TOKEN" \
  https://YOUR-AUTH-CONTENT-HOST/api/admin/analytics/overview
```

Returns (from existing `users` + `usage_events` only):

| Field | Source |
|-------|--------|
| `users.total` | `COUNT(*)` users |
| `users.newToday` / `newLast7d` / `newLast30d` | `users.created_at` windows (UTC) |
| `activity.dau` / `wau` / `mau` | distinct `usage_events.user_id` in 1 / 7 / 30 days |
| `usage.chat` / `scan` / `rag_query` / `file_analysis` / `image_generation` | `SUM(units)` total + today + `usersToday` |

No Pro/Free split in Phase 1. Requires `SERVICE_TOKEN` in env.

## Security
1. Identity from **JWT only** — never trust `body.userId`
2. Passwords hashed with **bcrypt**
3. Usage ≠ subscription (separate tables)
4. Quota exceeded → `403` + `QUOTA_EXCEEDED`
5. Admin analytics → **X-Service-Token** only

## Stack
Node 18+ · Express · SQLite (`node:sqlite`) or Postgres (`DATABASE_URL`) · JWT · bcryptjs

## Deploy (Render)
Web Service · Build `npm install` · Start `npm start` · Env `JWT_SECRET`, `SERVICE_TOKEN`, `DATABASE_URL` (recommended), `PORT`
