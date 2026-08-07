import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import { recordEvent } from '@/src/lib/events';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';

// Auth.js v5 reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET for Google, and AUTH_SECRET
// for session encryption, from the environment automatically.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  // First-party funnel telemetry. Best-effort: a telemetry failure must never block
  // a sign-in, so recordEvent swallows and traces rather than throwing.
  events: {
    async signIn({ user }) {
      await recordEvent({ name: 'signin', userId: user?.id ?? null });
    },
  },
  session: { strategy: 'database' },
  pages: { signIn: '/signin', signOut: '/signout' },
});
