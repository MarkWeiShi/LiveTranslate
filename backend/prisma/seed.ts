import { PrismaClient } from '@prisma/client';
import { SEED_PROFILES } from '../src/adapters/auth/seed-profiles';
import { serializeStrArr } from '../src/common/json-array.util';

const prisma = new PrismaClient();

async function main() {
  for (const p of SEED_PROFILES) {
    await prisma.user.upsert({
      where: { helloTalkUserId: p.sub },
      update: {},
      create: {
        helloTalkUserId: p.sub,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        nativeLanguage: p.nativeLanguage,
        learningLanguages: serializeStrArr(p.learningLanguages),
        languageLevel: p.languageLevel,
        gender: p.gender,
        region: p.region,
        timezone: p.timezone,
        bio: p.bio,
        interests: serializeStrArr(p.interests),
        realPersonVerified: p.realPersonVerified,
        trustScore: p.trustScore,
        wallet: {
          create: {
            diamonds: p.initialDiamonds,
            trialSecondsLeft: p.trialSecondsLeft,
          },
        },
      },
    });
    // eslint-disable-next-line no-console
    console.log(`seeded ${p.sub} (${p.gender}, ${p.nativeLanguage})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
