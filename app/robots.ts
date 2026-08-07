import type { MetadataRoute } from 'next';
import { abs } from '@/src/lib/site';

/**
 * Crawl policy. Permissive for the corpus, closed for anything private or
 * parameter-dependent.
 *
 * AI crawlers are allowed on the same terms as search crawlers rather than being
 * silently blocked: the 62 skill pages exist to be found, and an answer engine citing
 * them is the same win as a search result. See also /llms.txt.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = [
    '/api/',
    '/me',
    '/settings',
    '/signin',
    '/signout',
    '/compare', // useless without ?a=&b=, and the parameter space is unbounded
    '/u/',      // opt-in personal data, deliberately not in the sitemap either
  ];

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: abs('/sitemap.xml'),
    host: abs('/'),
  };
}
