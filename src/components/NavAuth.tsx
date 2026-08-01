'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type State = 'unknown' | 'in' | 'out';

/**
 * The account half of the primary menu — Profile · Card · Settings · Sign out
 * when signed in, Sign in when not.
 *
 * It reads the session on the *client* on purpose. `/skills` and
 * `/skill/[slug]` are statically generated; calling `auth()` inside `TopNav`
 * would read cookies and force all 63 of those pages to render per request.
 * Fetching `/api/auth/session` keeps them static, and it is the single account
 * menu the map header and the app pages both render, so both navs always agree.
 *
 * Renders nothing until the answer arrives: server and first client render
 * agree (no hydration mismatch), and we never flash "Sign in" at someone who
 * is already signed in.
 */
export function NavAuth() {
  const [state, setState] = useState<State>('unknown');

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((s: { user?: unknown } | null) => {
        if (alive) setState(s && s.user ? 'in' : 'out');
      })
      .catch(() => {
        /* offline or a failing session route — stay silent rather than claim
           the dancer is signed out; Map/Learn/Back still carry the page. */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'unknown') return null;

  if (state === 'out') {
    return (
      <Link className="tm-link" href="/signin">
        Sign in
      </Link>
    );
  }

  return (
    <>
      <Link className="tm-link" href="/me">Profile</Link>
      {/* /me/card is the canonical "my card" route — it resolves the handle, so
          the menu never has to know it. */}
      <Link className="tm-link" href="/me/card">Card</Link>
      <Link className="tm-link" href="/settings">Settings</Link>
      <Link className="tm-link" href="/signout">Sign out</Link>
    </>
  );
}
