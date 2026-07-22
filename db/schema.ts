import {
  pgTable, text, timestamp, primaryKey, integer, boolean, jsonb,
} from 'drizzle-orm/pg-core';

// --- Auth.js (@auth/drizzle-adapter) standard Postgres schema ---
export const users = pgTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = pgTable('account', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (a) => ({ pk: primaryKey({ columns: [a.provider, a.providerAccountId] }) }));

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (v) => ({ pk: primaryKey({ columns: [v.identifier, v.token] }) }));

// --- App tables ---
export const progress = pgTable('progress', {
  userId: text('userId').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  mastered: jsonb('mastered').$type<string[]>().notNull().default([]),
  theme: text('theme'),   // 'light' | 'dark' | null
  sel: text('sel'),       // last selected node slug
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
});

export const profile = pgTable('profile', {
  userId: text('userId').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  handle: text('handle').unique(),
  isPublic: boolean('isPublic').notNull().default(false),
  displayName: text('displayName'),
  style: text('style'),   // 'salon' | 'milonguero' | 'nuevo' | null
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
});
