export interface DepositResult {
  gatewayRef: string;
  raw?: unknown;
}

export interface PaymentGateway {
  /** Capture funds from the buyer into escrow (moves PENDING -> HELD). */
  deposit(params: { amountCents: number; currency: string; reference: string }): Promise<DepositResult>;
  /** Pay held funds out to the seller (moves HELD -> RELEASED). */
  release(params: { gatewayRef: string; amountCents: number }): Promise<void>;
  /** Return held funds to the buyer (moves HELD/DISPUTED -> REFUNDED). */
  refund(params: { gatewayRef: string; amountCents: number }): Promise<void>;
}
