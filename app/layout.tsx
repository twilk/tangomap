import { Figtree } from 'next/font/google';
// The generated token sheet SETS the .tm-profile custom properties (--tm-* light/
// dark, --serif/--sans/--mono); tango.css only CONSUMES them via var(). The two
// touch disjoint properties, so they never collide and source order is not load-
// bearing for correctness — custom-property resolution is independent of another
// property's source order, so tango's `background:var(--tm-ground)…` reads the
// tokens no matter which sheet webpack emits first. Kept first defensively: the
// parity test forbids tango re-declaring a token, and were that guard ever bypassed,
// source order would decide the winner. Single source of truth is design/tokens.ts →
// src/styles/generated/tokens.css.
import '@/src/styles/generated/tokens.css';
import './tango.css';

// The map bundle at / renders its body copy in Figtree (the "Organic" design
// system). next/font self-hosts it at build time — no CDN link, no font files —
// and exposes it as --font-figtree, which app/tango.css feeds into --sans.
const figtree = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree',
});

export const metadata = {
  title: 'Tango Map',
  description: 'An interactive skill map for Argentine tango — 62 techniques across 10 levels.',
};

// Mirror the map bundle's theme (localStorage tsm-theme; light by default, dark
// only on explicit toggle, or a fully custom palette) into data-theme before first
// paint, so the app pages and the map are always the same theme. No flash: runs
// before the body renders — for a custom theme the pre-built CSS (tsm-custom-css)
// is injected into a <style id="tm-custom-theme"> SYNCHRONOUSLY inside a(), before
// data-theme is set, so the custom palette paints on the very first frame. If the
// mode is 'custom' but no CSS is cached yet, we fall back to light rather than
// showing an unstyled custom surface.
// Also re-applies on `storage` (another tab flipped the theme or the custom CSS —
// live multi-tab sync) and on `pageshow[persisted]` (returning from the bfcache
// with a stale DOM), so the setting stays consistent no matter how you arrived.
// A meta[theme-color] is kept in step with the ground colour (custom uses the
// stored polarity) so the mobile browser chrome bar tracks the theme too (a
// MutationObserver covers the toggle, which sets data-theme directly rather than
// going through a()).
const THEME_SCRIPT =
  "(function(){function cs(){try{return localStorage.getItem('tsm-custom-css')}catch(e){return null}}function es(t){var s=document.getElementById('tm-custom-theme');if(!s){s=document.createElement('style');s.id='tm-custom-theme';document.head.appendChild(s)}s.textContent=t}function tc(d){var c;if(d==='custom'){var p;try{p=localStorage.getItem('tsm-custom-polarity')}catch(e){p=null}c=p==='dark'?'#110D09':'#f5ead8'}else{c=d==='dark'?'#110D09':'#f5ead8'}var m=document.querySelector('meta[name=theme-color]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m)}m.setAttribute('content',c)}function a(){var t;try{t=localStorage.getItem('tsm-theme')}catch(e){t=null}var d;if(t==='custom'){var x=cs();if(x){es(x);d='custom'}else{d='light'}}else if(t==='dark'){d='dark'}else{d='light'}document.documentElement.setAttribute('data-theme',d);tc(d)}a();try{addEventListener('storage',function(e){if(!e.key||e.key==='tsm-theme'||e.key==='tsm-custom-css'||e.key==='tsm-custom-polarity')a()});addEventListener('pageshow',function(e){if(e.persisted)a()});new MutationObserver(function(){tc(document.documentElement.getAttribute('data-theme'))}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})}catch(e){}})()";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={figtree.variable} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
        {/* Register the service worker for offline / installable PWA (public/sw.js). */}
        <script src="/sw-register.js" defer />
      </body>
    </html>
  );
}
