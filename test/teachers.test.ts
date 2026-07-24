import { test, expect, afterEach } from 'vitest';
import { isTeacher, isFoundingSerial, canSeeLessonVideos, FOUNDING_SERIAL_MAX } from '@/src/lib/teachers';

const orig = process.env.TEACHER_EMAILS;
afterEach(() => {
  if (orig === undefined) delete process.env.TEACHER_EMAILS;
  else process.env.TEACHER_EMAILS = orig;
});

test('with no allowlist, nobody is a teacher', () => {
  delete process.env.TEACHER_EMAILS;
  expect(isTeacher('a@b.com')).toBe(false);
});

test('allowlist matches case-insensitively, trims, and accepts mixed separators', () => {
  process.env.TEACHER_EMAILS = 'Alice@Example.com, bob@x.io ; carol@y.org';
  expect(isTeacher('alice@example.com')).toBe(true);
  expect(isTeacher('  BOB@X.IO ')).toBe(true);
  expect(isTeacher('carol@y.org')).toBe(true);
  expect(isTeacher('dave@z.com')).toBe(false);
});

test('empty, null, or undefined email is never a teacher', () => {
  process.env.TEACHER_EMAILS = 'a@b.com';
  expect(isTeacher(undefined)).toBe(false);
  expect(isTeacher(null)).toBe(false);
  expect(isTeacher('')).toBe(false);
});

// The first 50 accounts see the lesson videos too, identified by the card serial
// minted from a DB sequence. Serials are 1-based and never recomputed, so this
// window is stable even after deletions.
test('the founding window is the first 50 minted serials, inclusive', () => {
  expect(FOUNDING_SERIAL_MAX).toBe(50);
  expect(isFoundingSerial(1)).toBe(true); // wilk
  expect(isFoundingSerial(3)).toBe(true); // arti
  expect(isFoundingSerial(50)).toBe(true);
  expect(isFoundingSerial(51)).toBe(false);
  expect(isFoundingSerial(1000)).toBe(false);
});

test('an unminted or malformed serial is never founding', () => {
  // null/0 mean "no serial yet" — a profile predating the sequence, or none at
  // all. Treating 0 as founding would hand access to every such row.
  expect(isFoundingSerial(0)).toBe(false);
  expect(isFoundingSerial(null)).toBe(false);
  expect(isFoundingSerial(undefined)).toBe(false);
  expect(isFoundingSerial(-1)).toBe(false);
  expect(isFoundingSerial(1.5)).toBe(false);
});

test('either grant opens the gate, and neither one alone is required', () => {
  process.env.TEACHER_EMAILS = 'teacher@example.com';
  // on the teacher list, no serial at all
  expect(canSeeLessonVideos({ email: 'teacher@example.com', cardSerial: null })).toBe(true);
  // not a teacher, but a founding account
  expect(canSeeLessonVideos({ email: 'arti@example.com', cardSerial: 3 })).toBe(true);
  // neither
  expect(canSeeLessonVideos({ email: 'late@example.com', cardSerial: 51 })).toBe(false);
  expect(canSeeLessonVideos({})).toBe(false);
});
