import { describe, test, expect } from 'vitest';
import { EVENT_NAMES, isEventName, sanitizeProps, masteryDiff } from '@/src/lib/events';

// Gate 1 item 1 of the CEO roadmap. The table itself needs a database; these cover the
// pure logic that decides WHAT gets written — the allowlist that stops the table
// becoming a landfill, the PII filter, and the diff that produces the input metric.

describe('event name allowlist', () => {
  test('is exactly the eight names the roadmap specified', () => {
    expect([...EVENT_NAMES].sort()).toEqual([
      'compare_filled',
      'handle_claimed',
      'invite_copied',
      'link_open',
      'signin',
      'skill_mastered',
      'skill_page_view',
      'skill_unmastered',
    ]);
  });

  test('accepts every allowlisted name', () => {
    for (const n of EVENT_NAMES) expect(isEventName(n)).toBe(true);
  });

  test('rejects anything else, including near-misses and junk types', () => {
    for (const n of ['skill_master', 'SKILL_MASTERED', 'pageview', '', 'drop table', null, 42, {}]) {
      expect(isEventName(n)).toBe(false);
    }
  });
});

describe('props sanitiser — the PII line', () => {
  test('keeps allowlisted keys', () => {
    expect(sanitizeProps({ src: 'organic', a_present: true })).toEqual({ src: 'organic', a_present: true });
  });

  test('drops every key that is not allowlisted', () => {
    // The realistic accident: someone passes a whole object through.
    expect(sanitizeProps({ email: 'a@b.c', ip: '1.2.3.4', userAgent: 'Mozilla', note: 'free text' })).toBeNull();
  });

  test('keeps allowlisted keys and drops PII in the same object', () => {
    expect(sanitizeProps({ src: 'organic', email: 'a@b.c' })).toEqual({ src: 'organic' });
  });

  test('truncates strings so no free text can be smuggled through an allowed key', () => {
    const long = 'x'.repeat(500);
    const out = sanitizeProps({ src: long });
    expect((out!.src as string).length).toBe(32);
  });

  test('returns null for non-objects rather than throwing', () => {
    for (const v of [null, undefined, 'str', 42, []]) expect(sanitizeProps(v)).toBeNull();
  });
});

describe('mastery diff — the source of the input metric', () => {
  test('reports exactly one mastered and one unmastered on a swap', () => {
    // The roadmap's own worked example.
    expect(masteryDiff(['a', 'b'], ['a', 'c'])).toEqual({ mastered: ['c'], unmastered: ['b'] });
  });

  test('first ever mark', () => {
    expect(masteryDiff([], ['a'])).toEqual({ mastered: ['a'], unmastered: [] });
  });

  test('an unchanged save emits nothing — sync churn must not inflate the metric', () => {
    expect(masteryDiff(['a', 'b'], ['b', 'a'])).toEqual({ mastered: [], unmastered: [] });
  });

  test('clearing everything is all unmastered, no mastered', () => {
    expect(masteryDiff(['a', 'b'], [])).toEqual({ mastered: [], unmastered: ['a', 'b'] });
  });
});
