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

## Development

```bash
npm run dev      # Start dev server
npm run start    # Start production server
npm run lint     # Type check
```

## Deployment to Render

1. Connect your GitHub repo to Render as a Blueprint (or New Web Service)
2. Use the `render.yaml` blueprint in this repo — it provisions the web service, env vars, and a persistent disk at `/data`
3. Set the `sync: false` secrets in the Render dashboard when prompted: `GEMINI_API_KEY`, `JWT_SECRET`, `FRONTEND_URL`, `SMTP_PASS`

Key points:
- The start command runs `npx prisma db push` first so the SQLite schema is applied to the persistent disk on every boot
- `DATABASE_URL` must be `file:/data/mangistore.db` on Render so data survives redeploys (the disk is never wiped)
- Health check: `GET /api/health`