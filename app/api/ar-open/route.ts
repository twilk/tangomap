// Lightweight "immersive card was opened" beacon (navigator.sendBeacon POST from
// DancerCard). No body, no storage — just a log line so we can see in the Vercel
// function logs whether the AR mode gets used, before investing further in it.
// Never blocks or fails the client.
export const dynamic = 'force-dynamic';

export function POST() {
  console.log('[ar-open] immersive card opened');
  return new Response(null, { status: 204 });
}
