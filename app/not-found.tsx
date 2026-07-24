import { TopNav } from '@/src/components/TopNav';

// The global 404 boundary (also what /u/[handle] renders via notFound()), so the
// browser tab reads sensibly instead of the generic app title.
export const metadata = { title: 'Not found — Tango Map' };

export default function NotFound() {
  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <TopNav />
        <div className="tm-nf">
          <p className="code">404 · off the floor</p>
          <h1>This dancer stepped away</h1>
          <p>The profile you’re looking for is private or doesn’t exist. Handles change — try the map, or ask for the link again.</p>
          <a className="tm-cta" href="/">
            Back to the map <span className="tm-ar" aria-hidden="true">→</span>
          </a>
        </div>
      </main>
    </div>
  );
}
