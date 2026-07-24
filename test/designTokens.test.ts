import { test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCss } from '@/scripts/build-design.mjs';

const root = resolve(__dirname, '..');

test('the generated CSS file exists and is not stale', () => {
  const p = resolve(root, 'src/styles/generated/tokens.css');
  expect(existsSync(p), 'run: npm run design').toBe(true);
  expect(readFileSync(p, 'utf8')).toBe(buildCss());
});
