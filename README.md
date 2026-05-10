# Mangi Store Backend

GraphQL API backend for Mangi Store POS system, built with Apollo Server + Express.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Server:** Express.js
- **API:** Apollo Server (GraphQL)
- **Database:** Supabase (PostgreSQL + Auth)
- **AI:** Google Gemini API
- **Deployment:** Railway

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
| `GEMINI_API_KEY` | Google Gemini API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `FRONTEND_URL` | Frontend URL for CORS |
| `PORT` | Server port (default: 3000) |

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

## Deployment to Railway

1. Connect your GitHub repo to Railway
2. Set the environment variables in Railway dashboard
3. Railway will auto-detect and deploy

Required Railway variables:
- `PORT=3000`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `FRONTEND_URL` (your Vercel frontend URL)