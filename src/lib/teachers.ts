/**
 * Teacher allowlist. The source of truth is the partykateachers@googlegroups.com
 * group, but consumer Google Groups expose no membership API, so we mirror the
 * member emails into the TEACHER_EMAILS env var (separated by comma, semicolon,
 * or whitespace). Used to gate teacher-only content — currently the lesson
 * videos on skill pages.
 */
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
