import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditTransactions, user, type CreditTxType } from "@/lib/db/schema";
import { newId } from "./ids";

export class InsufficientCreditsError extends Error {
  constructor(public balanceMicros: number) {
    super("Insufficient credits");
  }
}

export async function getBalance(userId: string) {
  const [row] = await db.select({ credits: user.creditsMicros }).from(user).where(eq(user.id, userId));
  return row?.credits ?? 0;
}

/**
 * Adds (or removes, if negative) credits and writes a ledger entry atomically.
 * When `reference` is provided the grant is idempotent: replaying the same reference is a no-op.
 * Returns the new balance, or null when the reference was already applied.
 */
export async function grantCredits(input: {
  userId: string;
  amountMicros: number;
  type: CreditTxType;
  description: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}): Promise<number | null> {
  return db.transaction(async (tx) => {
    if (input.reference) {
      const [existing] = await tx
        .select({ id: creditTransactions.id })
        .from(creditTransactions)
        .where(eq(creditTransactions.reference, input.reference));
      if (existing) return null;
    }
    const [updated] = await tx
      .update(user)
      .set({ creditsMicros: sql`${user.creditsMicros} + ${input.amountMicros}` })
      .where(eq(user.id, input.userId))
      .returning({ credits: user.creditsMicros });
    if (!updated) throw new Error("User not found");
    await tx.insert(creditTransactions).values({
      id: newId("ctx"),
      userId: input.userId,
      amountMicros: input.amountMicros,
      balanceAfterMicros: updated.credits,
      type: input.type,
      description: input.description,
      reference: input.reference ?? null,
      metadata: input.metadata ?? {},
    });
    return updated.credits;
  });
}

/**
 * Charges AI usage for a run. One ledger row per run is upserted so the history stays readable,
 * while the balance is decremented after every model step (no overspending on long runs).
 */
export async function chargeRunUsage(input: {
  userId: string;
  runId: string;
  costMicros: number;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  if (input.costMicros <= 0) return getBalance(input.userId);
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(user)
      .set({ creditsMicros: sql`${user.creditsMicros} - ${input.costMicros}` })
      .where(eq(user.id, input.userId))
      .returning({ credits: user.creditsMicros });
    if (!updated) throw new Error("User not found");
    await tx
      .insert(creditTransactions)
      .values({
        id: newId("ctx"),
        userId: input.userId,
        amountMicros: -input.costMicros,
        balanceAfterMicros: updated.credits,
        type: "usage",
        description: input.description,
        reference: `run:${input.runId}`,
        metadata: input.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: creditTransactions.reference,
        set: {
          amountMicros: sql`${creditTransactions.amountMicros} - ${input.costMicros}`,
          balanceAfterMicros: updated.credits,
          description: input.description,
          metadata: input.metadata ?? {},
        },
      });
    return updated.credits;
  });
}

export async function assertCanSpend(userId: string, minimumMicros: number) {
  const balance = await getBalance(userId);
  if (balance < minimumMicros) throw new InsufficientCreditsError(balance);
  return balance;
}

export async function listTransactions(userId: string, limit = 50) {
  return db.query.creditTransactions.findMany({
    where: and(eq(creditTransactions.userId, userId)),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit,
  });
}

/** Total AI usage (micro-dollars) over the last `days` days. */
export async function getRecentUsage(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(-${creditTransactions.amountMicros}), 0)::bigint` })
    .from(creditTransactions)
    .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.type, "usage"), gte(creditTransactions.createdAt, since)));
  return Number(row?.total ?? 0);
}
