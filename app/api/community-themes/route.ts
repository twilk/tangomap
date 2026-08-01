import { getCommunityThemes } from '@/src/lib/publicProfile';

// Public gallery browsing — no auth. The read model is already gated (isShared AND
// author has a handle — sharing is decoupled from the public-profile toggle) and
// re-validated per row, so the response only ever carries the allow-listed public
// fields (name, seeds, author handle/displayName). Dynamic (a fresh DB read),
// CDN-cacheable for 60s so the gallery stays cheap under load.
export const dynamic = 'force-dynamic';

export async function GET() {
  const themes = await getCommunityThemes();
  return Response.json(themes, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
