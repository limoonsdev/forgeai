import { getBalance, listTransactions } from "@/lib/server/credits";
import { json, withApi } from "@/lib/server/api";

export const GET = withApi(async (_req, { auth }) => {
  const [balance, transactions] = await Promise.all([getBalance(auth.userId), listTransactions(auth.userId, 100)]);
  return json({
    balanceMicros: balance,
    balanceUsd: balance / 1_000_000,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amountMicros: t.amountMicros,
      balanceAfterMicros: t.balanceAfterMicros,
      description: t.description,
      createdAt: t.createdAt,
    })),
  });
});
