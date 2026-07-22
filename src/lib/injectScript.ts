const OPEN = '<script type="__bundler/template">';

/**
 * Bake `<script src="{scriptSrc}" defer></script>` as the last element of the bundle's
 * __bundler/template <head>. The template is a JSON-encoded HTML string in which closing
 * tags are escaped as / so the outer bundler <script> is never closed early; we preserve
 * that by re-escaping every "</" after re-encoding. Idempotent.
 */
export function injectScriptIntoTemplate(bundleHtml: string, scriptSrc: string): string {
  const i = bundleHtml.indexOf(OPEN);
  if (i < 0) throw new Error('injectScriptIntoTemplate: __bundler/template not found');
  const start = i + OPEN.length;
  const end = bundleHtml.indexOf('</script>', start);
  if (end < 0) throw new Error('injectScriptIntoTemplate: template close not found');

  const decoded: string = JSON.parse(bundleHtml.slice(start, end).trim());
  if (decoded.includes(scriptSrc)) return bundleHtml; // idempotent

  const headClose = decoded.indexOf('</head>');
  if (headClose < 0) throw new Error('injectScriptIntoTemplate: </head> not found in template');

  const tag = `<script src="${scriptSrc}" defer></script>`;
  const patched = decoded.slice(0, headClose) + tag + decoded.slice(headClose);
  const reencoded = JSON.stringify(patched).replace(/<\//g, '<\\u002F');

  return bundleHtml.slice(0, start) + '\n' + reencoded + '\n' + bundleHtml.slice(end);
}
