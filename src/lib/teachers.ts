/**
 * Who may see the teacher-only lesson videos.
 *
 * Two independent grants:
 *
 * 1. **Teachers** — the source of truth is the partykateachers@googlegroups.com
 *    group, but consumer Google Groups expose no membership API, so we mirror the
 *    member emails into the TEACHER_EMAILS env var (comma, semicolon or
 *    whitespace separated).
 * 2. **Founding accounts** — the first 50 dancers to sign up, identified by the
 *    `profile.cardSerial` minted once from a DB sequence (migration 0002). That
 *    serial is never recomputed, so deleting an account does not promote anyone
 *    else into the window.
 *
 * Keep the two concepts separate: `isTeacher` answers "is this address on the
 * teacher list", and is not the access check. `canSeeLessonVideos` is.
 */

/** Inclusive upper bound of the founding-account window. */
export const FOUNDING_SERIAL_MAX = 50;

export function teacherEmails(): Set<string> {
  return new Set(
    (process.env.TEACHER_EMAILS ?? '')
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isTeacher(email?: string | null): boolean {
  if (!email) return false;
  return teacherEmails().has(email.trim().toLowerCase());
}

/** A minted serial inside the founding window. Serials are 1-based; null/0 means
 * "never minted" (a profile row predating migration 0002, or no profile yet) and
 * must NOT count as founding. */
export function isFoundingSerial(serial?: number | null): boolean {
  return typeof serial === 'number' && Number.isInteger(serial) && serial >= 1 && serial <= FOUNDING_SERIAL_MAX;
}

/** The actual gate for lesson videos: on the teacher list, or a founding account. */
export function canSeeLessonVideos(viewer: { email?: string | null; cardSerial?: number | null }): boolean {
  return isTeacher(viewer.email) || isFoundingSerial(viewer.cardSerial);
}
