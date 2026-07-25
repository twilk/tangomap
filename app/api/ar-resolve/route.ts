import { getHandleBySerial } from '@/src/lib/publicProfile';

// L2 marker resolver: the scanner reads a marker id (= a dancer's mint serial)
// and asks for the handle to fetch the card texture. Privacy-gated in
// getHandleBySerial (null for private/missing), so a scanned marker can only
// ever surface a public card. Live DB read, never cached.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('id');
  const id = Number(raw);
  const handle = raw !== null && Number.isFinite(id) ? await getHandleBySerial(id) : null;
  if (!handle) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return Response.json({ handle });
}
