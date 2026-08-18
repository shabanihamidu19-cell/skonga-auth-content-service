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

## Security
1. Identity from **JWT only** — never trust `body.userId`
2. Passwords hashed with **bcrypt**
3. Usage ≠ subscription (separate tables)
4. Quota exceeded → `403` + `QUOTA_EXCEEDED`

## Stack
Node 18+ · Express · SQLite (`better-sqlite3`) · JWT · bcryptjs

## Deploy (Render)
Web Service · Build `npm install` · Start `npm start` · Env `JWT_SECRET`, `PORT`
