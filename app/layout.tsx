import './tango.css';

export const metadata = {
  title: 'Tango Map',
  description: 'An interactive skill map for Argentine tango — 62 techniques across 10 levels.',
};

// Mirror the map bundle's theme (localStorage tsm-theme; light by default, dark
// only on explicit toggle) into data-theme before first paint, so the app pages
// and the map are always the same theme. No flash: runs before the body renders.
const THEME_SCRIPT =
  "try{document.documentElement.setAttribute('data-theme',localStorage.getItem('tsm-theme')==='dark'?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
