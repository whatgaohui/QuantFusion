import { db } from '@/lib/db';

export const DEFAULT_USER_ID = 'default_user';

/**
 * Ensures the default user exists in the database.
 * Uses upsert to handle race conditions when multiple requests
 * call this simultaneously.
 */
export async function ensureDefaultUser(): Promise<string> {
  await db.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {},
    create: {
      id: DEFAULT_USER_ID,
      email: 'default@quantfusion.local',
      name: 'Default User',
    },
  });
  return DEFAULT_USER_ID;
}
