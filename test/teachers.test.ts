import { test, expect, afterEach } from 'vitest';
import { isTeacher } from '@/src/lib/teachers';

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
