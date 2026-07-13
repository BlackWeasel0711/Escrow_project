# Documentation

## API reference

- **[openapi.yaml](openapi.yaml)** — full OpenAPI 3.0 spec for every endpoint (request/response schemas, auth, error shapes).
- **[api.html](api.html)** — open in a browser to browse the spec interactively (Swagger UI, loaded from CDN). Serve the `docs/` folder over HTTP so it can fetch the YAML, e.g. `npx serve docs`.

## Architecture

```
┌────────────┐      ┌────────────┐      ┌──────────────┐
│  web/ SPA  │      │  android/  │      │  admin (web) │
└─────┬──────┘      └─────┬──────┘      └──────┬───────┘
      │  HTTPS + JWT      │                    │
      └───────────────────┴────────────────────┘
                          │
                 ┌────────▼─────────┐
                 │  backend/ (API)  │  Express + zod + Prisma
                 └────────┬─────────┘
             ┌────────────┼─────────────┐
        ┌────▼────┐  ┌────▼────┐   ┌────▼─────────────────┐
        │Postgres │  │ Payment │   │ PaymentGateway iface │
        │ (Prisma)│  │gateways │   │ paypal / mpesa / visa│
        └─────────┘  └─────────┘   └──────────────────────┘
```

- **Auth**: email/password, bcrypt (12 rounds), stateless JWT (7-day expiry). Role claim (`USER`/`ADMIN`) gates admin routes.
- **Escrow lifecycle**: `PENDING → HELD → (DISPUTED) → RELEASED | REFUNDED`. Every transition is written to `TransactionEvent` for an auditable timeline visible in both the user and admin views.
- **Payments**: each gateway implements one `PaymentGateway` interface (`deposit`/`release`/`refund`). `SIMULATE_PAYMENTS=true` swaps in a fake gateway so the whole flow runs with no real accounts.

## Deployment

### Fastest path — Docker Compose (one command)

From the repo root:

```
docker compose up --build
```

This builds and runs three services: **PostgreSQL**, the **API** (applies the schema on start,
listens on `http://localhost:4000`), and the **web** client via nginx (`http://localhost:8080`).
Override secrets/config with env vars, e.g. `JWT_SECRET=… SIMULATE_PAYMENTS=false docker compose up`.

### HTTPS / TLS

HTTPS is handled in code:
- `helmet` sends **HSTS** headers.
- `FORCE_HTTPS=true` redirects any plain-HTTP request to HTTPS (for running behind a
  TLS-terminating proxy such as Render, Nginx, or Cloudflare — `trust proxy` is set).
- To terminate TLS in the app itself, set `TLS_KEY_PATH` and `TLS_CERT_PATH` to your PEM files
  and the server starts as native HTTPS.

### Continuous integration

`.github/workflows/ci.yml` runs on every push/PR: backend typecheck + full end-to-end verify
(embedded PostgreSQL), web syntax check, and an **Android `assembleDebug` compile**.

## Manual deployment (outline)

1. **Database** — provision managed PostgreSQL (e.g. Neon, Supabase, RDS). Set `DATABASE_URL`.
2. **Backend** — build and run on any Node host (Render, Railway, Fly, a VM):
   ```
   cd backend
   npm ci
   npm run build
   npx prisma migrate deploy
   npm run prisma:seed        # creates the first admin
   npm start
   ```
   Set a strong `JWT_SECRET`, put the API behind HTTPS (reverse proxy / platform TLS), and restrict `cors()` to your web origin in production.
3. **Web** — static host (`web/`) on Netlify/Vercel/S3+CloudFront. Set `API_BASE` in `config.js` to the deployed API URL.
4. **Go live on payments** — add real sandbox → production credentials per gateway (see `backend/README.md`), set `SIMULATE_PAYMENTS=false`, and expose the M-Pesa callback URL publicly.

## Acceptance test (brief's criterion)

Run a transaction through **deposit → hold → dispute → release** for each method and confirm it appears in both the admin panel and the user's timeline. A scripted end-to-end version lives in [../backend/scripts/smoke.md](../backend/scripts/smoke.md).
