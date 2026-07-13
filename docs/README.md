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

## Deployment (outline)

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
