/**
 * Flag `<a href="/...">` — an internal link that is NOT next/link.
 *
 * Why this exists rather than `@next/next/no-html-link-for-pages`: that rule resolves
 * routes by globbing a `pages/` directory, so it is a no-op in an App Router project.
 * Verified empirically against this repo — it reported nothing for a planted
 * `<a href="/skills">`. This rule works off the JSX itself, so the router style is
 * irrelevant.
 *
 * What it costs when it regresses: a plain <a> triggers a full document reload —
 * blank flash, scroll reset, and every bit of un-pushed client state destroyed. In
 * this app that also used to drop the debounced progress PUT, silently losing a
 * "mastered" mark. See #49.
 *
 * NOT reported (all legitimate `<a>`):
 *   - external / protocol-relative / mailto: / tel: / #hash / javascript:
 *   - anything with `target` or `download` (leaving the SPA on purpose)
 *   - a file or line with an eslint-disable comment — for deliberate cases like
 *     BackLink, which pairs a real href with preventDefault + router.back().
 */

/** Same-origin paths that are NOT app routes, so next/link is the wrong tool: API
 *  handlers, and anything with a file extension (/favicon.ico, /cv.pdf, an exported
 *  .csv). Flagging these would make the gate block correct code. */
function isNonRoutePath(value) {
  if (value.startsWith('/api/')) return true;
  const path = value.split(/[?#]/)[0];
  return /\.[a-z0-9]{2,5}$/i.test(path);
}

/** An href value that should have been a <Link>: app-internal, single leading slash. */
function isInternalPath(value) {
  if (typeof value !== 'string') return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  return !isNonRoutePath(value);
}

/** Read a literal href out of `href="/x"` or {`/x/${y}`}; null when not statically known. */
function staticHref(attr) {
  const v = attr.value;
  if (!v) return null;
  if (v.type === 'Literal') return typeof v.value === 'string' ? v.value : null;
  if (v.type === 'JSXExpressionContainer') {
    const e = v.expression;
    if (e.type === 'Literal') return typeof e.value === 'string' ? e.value : null;
    // Template literal: only the leading text decides whether the path is internal.
    if (e.type === 'TemplateLiteral' && e.quasis.length > 0) return e.quasis[0].value.cooked ?? null;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export const noInternalAHref = {
  meta: {
    type: 'problem',
    docs: { description: 'Use next/link for internal navigation; a plain <a> reloads the whole document.' },
    schema: [],
    messages: {
      useLink:
        'Internal link "{{href}}" uses <a>, which reloads the whole document (losing client state). Use <Link href="…"> from next/link. If leaving the app is intended, add target/download — or disable this rule on the line with a reason.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'a') return;

        let href = null;
        let hrefAttr = null;
        let hrefIndex = -1;
        let lastSpreadIndex = -1;
        for (let i = 0; i < node.attributes.length; i++) {
          const attr = node.attributes[i];
          // A spread ({...props}) could carry href/target/download — but only the ones
          // AFTER an explicit href can override it. Record the position instead of
          // bailing outright, or `<a {...props} href="/skills">` escapes the rule even
          // though the later explicit href definitively wins.
          if (attr.type === 'JSXSpreadAttribute') { lastSpreadIndex = i; continue; }
          if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') continue;
          const n = attr.name.name;
          if (n === 'target' || n === 'download') return; // deliberately leaving the SPA
          if (n === 'href') {
            hrefAttr = attr;
            hrefIndex = i;
            href = staticHref(attr);
          }
        }

        // No explicit href, or a spread that could still overwrite it / add target:
        // can't know statically, so stay quiet rather than cry wolf.
        if (!hrefAttr || lastSpreadIndex > hrefIndex) return;

        if (isInternalPath(href)) {
          context.report({ node: hrefAttr, messageId: 'useLink', data: { href } });
        }
      },
    };
  },
};

export default { rules: { 'no-internal-a-href': noInternalAHref } };
