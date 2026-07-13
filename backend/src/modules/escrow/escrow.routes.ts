import { Router } from 'express';
import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';
import { requireAuth, AuthedRequest } from '../../common/middleware/auth.middleware';
import * as escrowService from './escrow.service';

export const escrowRouter = Router();
escrowRouter.use(requireAuth);

const createSchema = z.object({
  sellerEmail: z.string().email(),
  description: z.string().min(3).max(500),
  amountCents: z.number().int().positive(),
  method: z.nativeEnum(PaymentMethod),
});

escrowRouter.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const tx = await escrowService.createEscrow({ buyerId: req.user!.id, ...body });
    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

escrowRouter.get('/', async (req: AuthedRequest, res, next) => {
  try {
    res.json(await escrowService.listMyTransactions(req.user!.id));
  } catch (err) {
    next(err);
  }
});

escrowRouter.get('/:id', async (req: AuthedRequest, res, next) => {
  try {
    res.json(await escrowService.getTransaction(req.user!.id, req.params.id));
  } catch (err) {
    next(err);
  }
});

escrowRouter.post('/:id/confirm-received', async (req: AuthedRequest, res, next) => {
  try {
    res.json(await escrowService.confirmReceived(req.user!.id, req.params.id));
  } catch (err) {
    next(err);
  }
});
