export default function NotFound() {
  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <nav className="tm-top">
          <span className="tm-brand"><span className="d" aria-hidden="true" />Tango Map</span>
          <span className="tm-nav">
            <a className="tm-link" href="/">← The map</a>
          </span>
        </nav>
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
