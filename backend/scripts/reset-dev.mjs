// Dev helper: end dangling calls + reset all wallets to a clean slate. Run between smoke runs.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const calls = await p.callSession.updateMany({
  where: { status: { in: ['RINGING', 'ACTIVE'] } },
  data: { status: 'ENDED', endedAt: new Date() },
});
const wallets = await p.wallet.updateMany({
  data: { trialSecondsLeft: 420, subscriptionTier: 'NONE', subscriptionExpiry: null, diamonds: 0 },
});
console.log(`reset: ended ${calls.count} dangling call(s), reset ${wallets.count} wallet(s)`);
await p.$disconnect();
