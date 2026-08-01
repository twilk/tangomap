import type { ReactNode } from 'react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { BackLink } from './BackLink';
import { NavAuth } from './NavAuth';

/**
 * The shared top bar for every app screen:
 *
 *   brand · [← back] Map · Learn · <account items> · page extras · theme
 *
 * The account items (Profile · Card · Settings · Sign out, or Sign in) come
 * from the client-side <NavAuth/>, never from `auth()` here — TopNav is used by
 * the statically generated `/skills` and `/skill/[slug]`, and touching cookies
 * in this component would make all of them dynamic.
 *
 * `back` is the screen's logical parent: passing it renders a real back control
 * that prefers history and falls back to that URL. `children` stays for
 * page-specific extras. Compare is deliberately *not* in the menu — it only
 * makes sense from a dancer's profile or card, where there's someone to
 * compare with.
 */
export function TopNav({ back, children }: { back?: string; children?: ReactNode }) {
  return (
    <nav className="tm-top">
      <span className="tm-brand"><span className="d" aria-hidden="true" />Tango Map</span>
      <span className="tm-nav">
        {back && <BackLink fallback={back} />}
        <Link className="tm-link" href="/">Map</Link>
        <Link className="tm-link" href="/skills">Learn</Link>
        <NavAuth />
        {children}
        <ThemeToggle />
      </span>
    </nav>
  );
}
