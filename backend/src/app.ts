import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './modules/auth/auth.routes';
import { escrowRouter } from './modules/escrow/escrow.routes';
import { disputesRouter } from './modules/disputes/disputes.routes';
import { ratingsRouter } from './modules/ratings/ratings.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { errorHandler } from './common/middleware/error.middleware';

export const app = express();

// Behind a TLS-terminating proxy (Render/Nginx/Cloudflare), trust X-Forwarded-* so
// req.secure and req.protocol reflect the original HTTPS request.
app.set('trust proxy', 1);

// Security headers, incl. HSTS (tells browsers to only use HTTPS for 180 days).
app.use(
  helmet({
    hsts: { maxAge: 15552000, includeSubDomains: true, preload: true },
  })
);

// Enforce HTTPS in production: redirect any plain-HTTP request to its HTTPS URL.
// Enabled with FORCE_HTTPS=true (leave off in local dev). Health checks are exempt.
if (process.env.FORCE_HTTPS === 'true') {
  app.use((req, res, next) => {
    if (req.secure || req.path === '/health') return next();
    res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  });
}

// Restrict CORS to configured origins in production; allow all only when none are set (dev).
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/transactions', escrowRouter);
app.use('/api/disputes', disputesRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);
