import { PaymentKind, PaymentMethod, TransactionStatus } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../common/middleware/error.middleware';
import { getGateway } from '../payments/payments.service';
import { notify, notifyBoth } from '../notifications/notifications.service';

const money = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// States in which funds are held in escrow and the buyer may confirm receipt or dispute.
const HELD_STATES: TransactionStatus[] = [
  TransactionStatus.HELD,
  TransactionStatus.SHIPPED,
  TransactionStatus.DELIVERED,
];

async function logEvent(
  transactionId: string,
  fromStatus: TransactionStatus | null,
  toStatus: TransactionStatus,
  note?: string
) {
  await prisma.transactionEvent.create({
    data: { transactionId, fromStatus, toStatus, note },
  });
}

/** Records a payment-ledger entry (deposit/release/refund) for admin/payment tracking. */
async function recordPayment(tx: { id: string; method: PaymentMethod; amountCents: number; gatewayRef: string | null }, kind: PaymentKind) {
  await prisma.payment.create({
    data: { transactionId: tx.id, method: tx.method, kind, amountCents: tx.amountCents, gatewayRef: tx.gatewayRef, status: 'SUCCESS' },
  });
}

export async function createEscrow(params: {
  buyerId: string;
  sellerEmail: string;
  description: string;
  amountCents: number;
  method: PaymentMethod;
}) {
  const seller = await prisma.user.findUnique({ where: { email: params.sellerEmail } });
  if (!seller) throw new HttpError(404, 'No account found for that seller email');
  if (seller.id === params.buyerId) throw new HttpError(400, "You can't open an escrow with yourself");

  const transaction = await prisma.transaction.create({
    data: {
      buyerId: params.buyerId,
      sellerId: seller.id,
      description: params.description,
      amountCents: params.amountCents,
      method: params.method,
      status: TransactionStatus.PENDING,
    },
  });
  await logEvent(transaction.id, null, TransactionStatus.PENDING, 'Escrow created');

  // Kick off the deposit immediately; in the PayPal/Visa flows this returns a
  // reference the frontend then uses to complete buyer approval/3DS.
  const gateway = getGateway(params.method);
  const { gatewayRef } = await gateway.deposit({
    amountCents: params.amountCents,
    currency: 'KES',
    reference: transaction.id,
  });

  const held = await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: TransactionStatus.HELD, gatewayRef },
  });
  await logEvent(transaction.id, TransactionStatus.PENDING, TransactionStatus.HELD, 'Funds captured and locked');
  await recordPayment(held, PaymentKind.DEPOSIT);

  const amount = money(params.amountCents, held.currency);
  await notify(seller.id, `You have a new escrow of ${amount} for "${params.description}". Funds are held until the buyer confirms delivery.`, transaction.id);
  await notify(params.buyerId, `Your payment of ${amount} is held safely in escrow for "${params.description}".`, transaction.id);

  return held;
}

export async function listMyTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    orderBy: { createdAt: 'desc' },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
}

/** Average rating + number of ratings a user has received (seller reputation). */
export async function reputation(userId: string) {
  const ratings = await prisma.rating.findMany({ where: { rateeId: userId }, select: { score: true } });
  const count = ratings.length;
  const average = count ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / count) * 10) / 10 : null;
  return { average, count };
}

export async function getTransaction(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
      dispute: { include: { evidence: true } },
      rating: true,
      seller: { select: { id: true, email: true } },
    },
  });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.buyerId !== userId && tx.sellerId !== userId) throw new HttpError(403, 'Not your transaction');
  return { ...tx, sellerReputation: await reputation(tx.sellerId) };
}

/** Seller marks the item as shipped (HELD -> SHIPPED). */
export async function markShipped(userId: string, transactionId: string, note?: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.sellerId !== userId) throw new HttpError(403, 'Only the seller can update shipping');
  if (tx.status !== TransactionStatus.HELD) throw new HttpError(409, `Cannot mark shipped from status ${tx.status}`);

  const updated = await prisma.transaction.update({ where: { id: transactionId }, data: { status: TransactionStatus.SHIPPED } });
  await logEvent(transactionId, TransactionStatus.HELD, TransactionStatus.SHIPPED, note ? `Shipped — ${note}` : 'Seller marked as shipped');
  await notify(tx.buyerId, `Your order "${tx.description}" has been shipped by the seller.`, transactionId);
  return updated;
}

/** Seller marks the item as delivered (SHIPPED -> DELIVERED). */
export async function markDelivered(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.sellerId !== userId) throw new HttpError(403, 'Only the seller can update shipping');
  if (tx.status !== TransactionStatus.SHIPPED) throw new HttpError(409, `Cannot mark delivered from status ${tx.status}`);

  const updated = await prisma.transaction.update({ where: { id: transactionId }, data: { status: TransactionStatus.DELIVERED } });
  await logEvent(transactionId, TransactionStatus.SHIPPED, TransactionStatus.DELIVERED, 'Seller marked as delivered');
  await notify(tx.buyerId, `Your order "${tx.description}" is marked delivered. Please confirm receipt to release payment.`, transactionId);
  return updated;
}

/** Buyer confirms receipt: releases held funds to the seller (from HELD/SHIPPED/DELIVERED). */
export async function confirmReceived(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.buyerId !== userId) throw new HttpError(403, 'Only the buyer can confirm receipt');
  if (!HELD_STATES.includes(tx.status)) {
    throw new HttpError(409, `Cannot release funds from status ${tx.status}`);
  }

  const gateway = getGateway(tx.method);
  await gateway.release({ gatewayRef: tx.gatewayRef!, amountCents: tx.amountCents });

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: TransactionStatus.RELEASED },
  });
  await logEvent(transactionId, tx.status, TransactionStatus.RELEASED, 'Buyer confirmed receipt');
  await recordPayment(tx, PaymentKind.RELEASE);
  await notifyBoth(tx.buyerId, tx.sellerId, `The buyer confirmed receipt — ${money(tx.amountCents, tx.currency)} has been released to the seller.`, transactionId);
  return updated;
}

/** Called by the dispute module once an admin rules on a case. */
export async function applyDisputeRuling(
  transactionId: string,
  ruling: 'RELEASE' | 'REFUND'
) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.status !== TransactionStatus.DISPUTED) {
    throw new HttpError(409, `Cannot rule on a transaction in status ${tx.status}`);
  }

  const gateway = getGateway(tx.method);
  const toStatus = ruling === 'RELEASE' ? TransactionStatus.RELEASED : TransactionStatus.REFUNDED;

  if (ruling === 'RELEASE') {
    await gateway.release({ gatewayRef: tx.gatewayRef!, amountCents: tx.amountCents });
  } else {
    await gateway.refund({ gatewayRef: tx.gatewayRef!, amountCents: tx.amountCents });
  }

  const updated = await prisma.transaction.update({ where: { id: transactionId }, data: { status: toStatus } });
  await logEvent(transactionId, TransactionStatus.DISPUTED, toStatus, `Admin ruling: ${ruling}`);
  await recordPayment(tx, ruling === 'RELEASE' ? PaymentKind.RELEASE : PaymentKind.REFUND);
  const outcome = ruling === 'RELEASE'
    ? `released to the seller`
    : `refunded to the buyer`;
  await notifyBoth(tx.buyerId, tx.sellerId, `An admin resolved the dispute: ${money(tx.amountCents, tx.currency)} has been ${outcome}.`, transactionId);
  return updated;
}

export async function markDisputed(transactionId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.status !== TransactionStatus.HELD) {
    throw new HttpError(409, 'Only a held transaction can be disputed');
  }
  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: TransactionStatus.DISPUTED },
  });
  await logEvent(transactionId, TransactionStatus.HELD, TransactionStatus.DISPUTED, 'Dispute opened');
  await notifyBoth(tx.buyerId, tx.sellerId, `A dispute was opened on your ${money(tx.amountCents, tx.currency)} escrow. Funds stay locked until an admin resolves it.`, transactionId);
  return updated;
}
