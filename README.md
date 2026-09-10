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
# SERVICE_TOKEN=$(openssl rand -hex 32)
npm install
npm start
# → http://localhost:4000/health
```

## API

### Auth
- `POST /api/auth/signup` `{ email, password, name? }` → `{ user, token }`
- `POST /api/auth/login` `{ email, password }` → `{ user, token }`
- `GET /api/auth/me` `Authorization: Bearer <JWT>`
- `POST /api/auth/logout`

### Content (JWT required)
- `POST /api/content` · `GET /api/content` · `GET /api/content/:id` · `DELETE /api/content/:id`
- `POST /api/content/upload` multipart `file`

### Usage (JWT required)
- `GET /api/usage` — entitlement + today quotas
- `GET /api/usage/check?action=chat` — allow/deny before AI
- `POST /api/usage/record` `{ action, units? }` — after successful AI

**Actions:** `chat` · `scan` · `image_generation` · `rag_query` · `file_analysis`

### Internal (server-to-server)
- `GET /api/internal/usage/check?userId=&action=` — header `X-Service-Token`
- `POST /api/internal/usage/record` `{ userId, action, units?, metadata? }` — header `X-Service-Token`

### Admin (header `X-Service-Token: <SERVICE_TOKEN>`)
- `GET /api/admin/users` — list users (+ plan)
- `GET /api/admin/stats` — `{ users, time }`
- `GET /api/admin/analytics/overview` — **Phase 1 product analytics**

Example:

```bash
curl -s -H "X-Service-Token: $SERVICE_TOKEN" \
  https://YOUR-AUTH-CONTENT-HOST/api/admin/analytics/overview
```

Response fields:
- `users.total` / `users.newToday` / `new7d` / `new30d`
- `activeUsers.dau` / `wau` / `mau` (distinct `user_id` in `usage_events`)
- `usage.allTime` + `usage.today` for `chat`, `scan`, `rag_query`, `file_analysis`, `image_generation`

No Pro/Free split in Phase 1. No new tables.

## Security
1. Identity from **JWT only** — never trust `body.userId` on user routes
2. Passwords hashed with **bcrypt**
3. Usage ≠ subscription (separate tables)
4. Quota exceeded → `403` + `QUOTA_EXCEEDED`
5. Admin + internal routes require **SERVICE_TOKEN** via `X-Service-Token`

## Stack
Node 18+ · Express · Postgres (`DATABASE_URL`) or SQLite · JWT · bcryptjs

## Deploy (Render)
Web Service · Build `npm install` · Start `npm start` · Env `JWT_SECRET`, `SERVICE_TOKEN`, `PORT`, preferred `DATABASE_URL`
