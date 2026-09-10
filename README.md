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

```bash
export TOKEN=your_SERVICE_TOKEN
export HOST=https://YOUR-AUTH-CONTENT-HOST
```

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List users + plan |
| GET | `/api/admin/stats` | User count |
| GET | `/api/admin/analytics/overview` | Phase 1 KPIs |
| GET | `/api/admin/analytics/growth?days=30` | Phase 2 signups + DAU/day |
| GET | `/api/admin/analytics/usage?days=30&action=all` | Phase 2 usage series |
| GET | `/api/admin/analytics/retention?cohortDays=14` | Phase 2 D1/D7 retention |

```bash
curl -s -H "X-Service-Token: $TOKEN" "$HOST/api/admin/analytics/overview"
curl -s -H "X-Service-Token: $TOKEN" "$HOST/api/admin/analytics/growth?days=30"
curl -s -H "X-Service-Token: $TOKEN" "$HOST/api/admin/analytics/usage?days=30&action=chat"
curl -s -H "X-Service-Token: $TOKEN" "$HOST/api/admin/analytics/retention?cohortDays=14"
```

**Overview fields** (from `users` + `usage_events` only):

| Field | Source |
|-------|--------|
| `users.total` | `COUNT(*)` users |
| `users.newToday` / `newLast7d` / `newLast30d` | `users.created_at` (UTC) |
| `activity.dau` / `wau` / `mau` | distinct `usage_events.user_id` |
| `usage.*` | `SUM(units)` total + today |

**Growth:** daily `newUsers` + daily `dau` for `?days=1..90`  
**Usage:** `byAction` window totals + daily `units` series (`action=all|chat|scan|…`)  
**Retention:** signup cohorts with D1/D7 return rates (null until mature)

Requires `SERVICE_TOKEN` in env. Prefer `DATABASE_URL` (Postgres) in production.

## Security
1. Identity from **JWT only** — never trust `body.userId` on user routes
2. Passwords hashed with **bcrypt**
3. Usage ≠ subscription (separate tables)
4. Quota exceeded → `403` + `QUOTA_EXCEEDED`
5. Admin analytics → **X-Service-Token** only

## Stack
Node 18+ · Express · SQLite (`node:sqlite`) or Postgres (`DATABASE_URL`) · JWT · bcryptjs

## Deploy (Render)
Web Service · Build `npm install` · Start `npm start` · Env `JWT_SECRET`, `SERVICE_TOKEN`, `DATABASE_URL` (recommended), `PORT`
