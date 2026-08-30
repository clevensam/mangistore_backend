# Mangi Store Backend

GraphQL API backend for Mangi Store POS system, built with Apollo Server + Express.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Server:** Express.js
- **API:** Apollo Server (GraphQL)
- **Database:** SQLite via Prisma ORM
- **AI:** Google Gemini API
- **Deployment:** Render

## Setup

```bash
npm install
cp .env.example .env
# Fill in your .env values
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite file URL, e.g. `file:./dev.db` (local) or `file:/data/mangistore.db` (Render disk) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `FRONTEND_URL` | Frontend URL for CORS |
| `PORT` | Server port (default: 3000) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `DEFAULT_FROM_EMAIL` | SMTP (Brevo) for OTP emails |

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/logout` - Logout
- `POST /graphql` - GraphQL endpoint
- `POST /api/ai/generate` - Authenticated Gemini proxy (body: `{ prompt, model? }`)
- `POST /api/ai/chat` - Authenticated Gemini proxy (body: `{ messages: [{role, text}], model? }`)

The `/api/ai/*` routes require the JWT (`Authorization: Bearer <token>`). They keep
`GEMINI_API_KEY` on the server — never expose it to the browser.

## Development

```bash
npm run dev      # Start dev server
npm run start    # Start production server (applies SQLite schema first)
npm run lint     # Type check
```

The app self-creates the SQLite schema on boot: `start` runs `prisma db push`
first, and the server also checks on startup that the `profiles` table exists,
running `prisma db push` automatically if the database is empty.

## Deployment to Render

1. Connect your GitHub repo to Render as a Blueprint (or New Web Service)
2. Use the `render.yaml` blueprint in this repo — it provisions the web service and env vars
3. Set the `sync: false` secrets in the Render dashboard when prompted: `GEMINI_API_KEY`, `JWT_SECRET`, `FRONTEND_URL`, `SMTP_PASS`

Key points:
- The start command (`npm run start`) applies the SQLite schema on every boot, so tables are created automatically even on a fresh/empty database
- `DATABASE_URL` is `file:/data/mangistore.db`
- **Free tier caveat:** Render's free services have an ephemeral filesystem — the database (and any data) is reset on every spin-down, restart, or redeploy. The schema is re-created on boot. For persistent data, upgrade to a paid plan (Starter) and add a persistent disk mounted at `/data`
- Health check: `GET /api/health`