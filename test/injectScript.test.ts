import { test, expect } from 'vitest';
import { injectScriptIntoTemplate } from '@/src/lib/injectScript';

// Minimal stand-in for the bundle: a __bundler/template script whose value is JSON HTML,
// with closing tags escaped as / exactly like the real bundle.
function fakeBundle(templateHtml: string): string {
  const json = JSON.stringify(templateHtml).replace(/<\//g, '<\\u002F');
  return `<html><body>\n<script type="__bundler/template">\n${json}\n</script>\n</body></html>`;
}

function decodeTemplate(bundle: string): string {
  const open = '<script type="__bundler/template">';
  const i = bundle.indexOf(open) + open.length;
  const j = bundle.indexOf('</script>', i);
  return JSON.parse(bundle.slice(i, j).trim());
}

test('injects the script before </head> inside the template', () => {
  const bundle = fakeBundle('<!DOCTYPE html>\n<html><head>\n<title>x</title>\n</head>\n<body>hi</body></html>');
  const out = injectScriptIntoTemplate(bundle, '/sync.js');
  const decoded = decodeTemplate(out);
  expect(decoded).toContain('<script src="/sync.js" defer></script>');
  expect(decoded.indexOf('/sync.js')).toBeLessThan(decoded.indexOf('</head>'));
});

test('result stays valid JSON with no literal </script inside the template', () => {
  const bundle = fakeBundle('<html><head></head><body></body></html>');
  const out = injectScriptIntoTemplate(bundle, '/sync.js');
  const open = '<script type="__bundler/template">';
  const i = out.indexOf(open) + open.length;
  const j = out.indexOf('</script>', i);
  const raw = out.slice(i, j);
  expect(() => JSON.parse(raw.trim())).not.toThrow();
  expect(/<\/script/i.test(raw)).toBe(false);
});

test('is idempotent', () => {
  const bundle = fakeBundle('<html><head></head><body></body></html>');
  const twice = injectScriptIntoTemplate(injectScriptIntoTemplate(bundle, '/sync.js'), '/sync.js');
  const count = (decodeTemplate(twice).match(/\/sync\.js/g) || []).length;
  expect(count).toBe(1);
});
