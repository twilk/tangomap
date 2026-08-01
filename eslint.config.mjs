// ESLint flat config (ESLint 9). This is a REGRESSION GATE, not a style checker —
// formatting is not policed here, only mistakes that have actually bitten this repo.
//
// The rule that earned the gate: `no-html-link-for-pages`. Every internal link in the
// app used to be a plain <a href>, so each click was a full document reload; #49
// converted 50 of them to next/link. Nothing was stopping them coming back.
//
// Everything is `error` — a warning nobody sees is not a gate.

import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import localRules from './eslint-rules/no-internal-a-href.mjs';

/** Paths ESLint should never walk: generated output and vendored third-party code. */
const IGNORES = [
  '.next/**',
  'node_modules/**',
  'src/styles/generated/**', // written by `npm run design`
  'drizzle/**', // generated migrations
  'playwright-report/**',
  'test-results/**',
  'public/vendor/**', // vendored js-aruco (AR marker detection) — not ours to restyle
];

export default tseslint.config(
  { ignores: IGNORES },

  // --- TypeScript / JavaScript correctness -----------------------------------
  {
    files: ['**/*.{ts,tsx,mts,mjs,js}'],
    extends: [tseslint.configs.recommended],
    rules: {
      // Unused code is usually a leftover from an edit that didn't finish. Allow the
      // deliberate `_`-prefixed throwaways the codebase already uses (e.g. `_req`).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          // `const { elev, ...rest } = o` is how this codebase OMITS a key — the named
          // binding is the mechanism, not a leftover.
          ignoreRestSiblings: true,
        },
      ],
      // `any` erases the type safety the rest of the codebase relies on. The existing
      // code models untrusted input as `unknown` and narrows it — keep it that way.
      '@typescript-eslint/no-explicit-any': 'error',
      // The canvas renderers use `cond ? a() : b()` to pick a side effect — a
      // deliberate, readable idiom here, not a dropped result.
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
    },
  },

  // --- React hooks ------------------------------------------------------------
  // Registered explicitly: Next's shareable config REFERENCES these rules, so without
  // the plugin an inline `eslint-disable react-hooks/exhaustive-deps` errors with
  // "rule not found". They also earn their place — a wrong dep array is a stale
  // closure, which is exactly the class of "screen doesn't update" bug this app just
  // spent a release fixing.
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // --- Next.js app rules ------------------------------------------------------
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, local: localRules },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // THE gate (see header): internal <a href> must be next/link.
      // NOTE: Next's own `no-html-link-for-pages` does NOT do this job here — it
      // resolves routes from a `pages/` dir and reported nothing for a planted
      // `<a href="/skills">` in this App Router repo (verified). Turned off so it
      // can't be mistaken for coverage; `local/no-internal-a-href` is the real gate.
      '@next/next/no-html-link-for-pages': 'off',
      'local/no-internal-a-href': 'error',
      // The recommended set ships most rules as 'warn'. A warning nobody reads is
      // not a gate — CI runs with --max-warnings=0 so they fail the build anyway.
    },
  },

  // --- Tests + scripts: looser -------------------------------------------------
  {
    files: ['test/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}', 'scripts/**/*.{mjs,js,ts}'],
    rules: {
      // Test doubles legitimately reach for `any` when stubbing browser APIs.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
