import {
  pgTable, text, timestamp, primaryKey, integer, boolean, jsonb, index,
} from 'drizzle-orm/pg-core';
import type { Theme } from '../src/lib/theme';

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
}, (a) => [primaryKey({ columns: [a.provider, a.providerAccountId] })]);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (v) => [primaryKey({ columns: [v.identifier, v.token] })]);

// --- App tables ---
export const progress = pgTable('progress', {
  userId: text('userId').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  mastered: jsonb('mastered').$type<string[]>().notNull().default([]),
  theme: text('theme'),   // 'light' | 'dark' | null
  sel: text('sel'),       // last selected node slug
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
});

// Daily snapshots of the mastered set (one row per user per day, upserted on
// progress writes). Powers "growth" views like the card's ghost blob.
export const progressHistory = pgTable('progress_history', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: text('day').notNull(), // YYYY-MM-DD (UTC)
  mastered: jsonb('mastered').$type<string[]>().notNull().default([]),
}, (h) => [primaryKey({ columns: [h.userId, h.day] })]);

export const profile = pgTable('profile', {
  userId: text('userId').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  handle: text('handle').unique(),
  isPublic: boolean('isPublic').notNull().default(false),
  displayName: text('displayName'),
  style: text('style'),   // 'salon' | 'milonguero' | 'nuevo' | null
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  // Minted once (DB sequence default; see migration 0002), never recomputed —
  // deleting other accounts must not renumber anyone's card.
  cardSerial: integer('cardSerial').unique(),
  // Custom theme: the four-seed Theme struct ({v,ground,ink,accent,accent2}),
  // validated by parseTheme on every write. Null = no custom theme.
  customTheme: jsonb('customTheme').$type<Theme>(),
  // Whether the dancer card renders in this custom theme (step 5).
  cardUsesCustomTheme: boolean('cardUsesCustomTheme').notNull().default(false),
  // Whether the custom theme is offered on the public profile for others to
  // apply (step 6). Independent of isPublic — you can share a theme without a
  // public DNA page, or vice-versa.
  themeShared: boolean('themeShared').notNull().default(false),
  // Last write to customTheme — the clock for last-write-wins cross-device sync.
  customThemeUpdatedAt: timestamp('customThemeUpdatedAt', { mode: 'date' }),
});

// A user's saved theme presets (library, ≤5 enforced in the API). The ACTIVE
// theme still lives in profile.customTheme; a preset is a named, reusable set of
// seeds. At most one preset per user may be `isShared` (community gallery),
// enforced in the API. Applying a preset copies its seeds into profile.customTheme.
export const themePreset = pgTable('theme_preset', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  seeds: jsonb('seeds').$type<Theme>().notNull(),
  isShared: boolean('isShared').notNull().default(false),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => [index('theme_preset_userId_idx').on(t.userId)]);

// First-party telemetry. The ONLY instrumentation in this app: no PostHog, no
// Plausible, no gtag, no @vercel/analytics — nothing leaves our infrastructure.
// Deliberately absent columns: IP address, user agent, email, any free-text field.
//
// `progress.mastered` is a jsonb array with ONE updatedAt for the whole set, and
// progress_history is a day-granularity snapshot. Per-skill mastery timing did not
// exist and could not be reconstructed; `skill_mastered` rows with a slug and a ts
// are what make "where did they stall" a SQL query later instead of a migration later.
export const events = pgTable('event', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ts: timestamp('ts', { mode: 'date' }).notNull().defaultNow(),
  // Nullable: signed-out events (link_open) have no user yet.
  userId: text('userId').references(() => users.id, { onDelete: 'cascade' }),
  // First-party random id in an httpOnly cookie, so a signed-out link_open can be
  // joined to the signin that follows. Not a fingerprint, not shared across sites.
  anonId: text('anonId'),
  name: text('name').notNull(),
  // Skill slug for skill_mastered / skill_unmastered / skill_page_view. Else null.
  slug: text('slug'),
  // Small, allowlisted, non-PII. e.g. { src: 'organic' }.
  props: jsonb('props').$type<Record<string, string | number | boolean>>(),
}, (e) => [
  index('event_name_ts_idx').on(e.name, e.ts),
  index('event_user_ts_idx').on(e.userId, e.ts),
  index('event_anon_ts_idx').on(e.anonId, e.ts),
]);
