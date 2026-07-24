import { Figtree } from 'next/font/google';
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
// only on explicit toggle) into data-theme before first paint, so the app pages
// and the map are always the same theme. No flash: runs before the body renders.
// Also re-applies on `storage` (another tab flipped the theme — live multi-tab
// sync) and on `pageshow[persisted]` (returning from the bfcache with a stale
// DOM), so the setting stays consistent no matter how you arrived at the page.
// A meta[theme-color] is kept in step with the ground colour so the mobile
// browser chrome bar tracks the theme too (a MutationObserver covers the toggle,
// which sets data-theme directly rather than going through a()).
const THEME_SCRIPT =
  "(function(){function tc(d){var m=document.querySelector('meta[name=\\\"theme-color\\\"]');if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m)}m.setAttribute('content',d==='dark'?'#110D09':'#f5ead8')}function a(){var d;try{d=localStorage.getItem('tsm-theme')==='dark'?'dark':'light'}catch(e){d='light'}document.documentElement.setAttribute('data-theme',d);tc(d)}a();try{addEventListener('storage',function(e){if(!e.key||e.key==='tsm-theme')a()});addEventListener('pageshow',function(e){if(e.persisted)a()});new MutationObserver(function(){tc(document.documentElement.getAttribute('data-theme'))}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})}catch(e){}})()";

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
