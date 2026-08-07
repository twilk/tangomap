-- THE input metric. This is the definition of "complete" from the CEO roadmap:
--
--   >= 3 of the 5 currently-active users mark >= 1 new skill in each of four
--   consecutive weekly rollups.
--
-- Not a dashboard. Not a funnel product. A file with a query in it, run by hand.
-- Run against the production database (DIRECT_URL) whenever you want the number.

SELECT date_trunc('week', ts)                                                  AS wk,
       count(*) FILTER (WHERE name = 'skill_mastered')                         AS marks,
       count(DISTINCT "userId") FILTER (WHERE name = 'skill_mastered')          AS active_users,
       round(
         count(*) FILTER (WHERE name = 'skill_mastered')::numeric
         / NULLIF(count(DISTINCT "userId") FILTER (WHERE name = 'skill_mastered'), 0)
       , 1)                                                                     AS marks_per_active_user
FROM "event"
GROUP BY 1
ORDER BY 1 DESC;

-- Are we complete? Four consecutive weeks with >= 3 distinct users marking.
-- Reading: four rows of `true` at the top = the definition is met.
--
-- SELECT wk, active_users, active_users >= 3 AS meets_bar
-- FROM (
--   SELECT date_trunc('week', ts) AS wk,
--          count(DISTINCT "userId") FILTER (WHERE name = 'skill_mastered') AS active_users
--   FROM "event" GROUP BY 1
-- ) w ORDER BY wk DESC LIMIT 4;

-- Activation is DERIVED, never stored — nothing to keep in sync, nothing to backfill wrong.
--
-- SELECT "userId", min(ts) AS activated_at
-- FROM "event" WHERE name = 'skill_mastered' GROUP BY "userId" ORDER BY 2;

-- The stall point: the last skill each user marked, and how long ago.
-- This is the question the five founder phone calls are asking in person, and the
-- reason skill_mastered carries a slug — progress.mastered could never answer it.
--
-- SELECT DISTINCT ON ("userId") "userId", slug AS last_skill, ts, now() - ts AS idle_for
-- FROM "event" WHERE name = 'skill_mastered' ORDER BY "userId", ts DESC;

-- Gate 3 entry condition: does the invite loop have senders?
--
-- SELECT name, count(*) FROM "event"
-- WHERE name IN ('link_open','signin','handle_claimed','compare_filled','invite_copied')
-- GROUP BY name ORDER BY 2 DESC;
