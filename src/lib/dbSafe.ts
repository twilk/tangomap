/** True when a DB error is "relation does not exist" (Postgres 42P01) — i.e. a
 *  table declared in the schema but not yet migrated into this database. */
export function isMissingTable(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '42P01';
}
