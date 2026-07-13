import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './modules/auth/auth.routes';
import { escrowRouter } from './modules/escrow/escrow.routes';
import { disputesRouter } from './modules/disputes/disputes.routes';
import { ratingsRouter } from './modules/ratings/ratings.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { errorHandler } from './common/middleware/error.middleware';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/transactions', escrowRouter);
app.use('/api/disputes', disputesRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);
