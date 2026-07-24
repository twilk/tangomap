import type { MetadataRoute } from 'next';

// Served at /manifest.webmanifest. Next auto-links it on the app pages; the map
// bundle (served statically at /) gets the <link rel="manifest"> injected into
// its head. Light "ground" colours match the default (non-dark) theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tango Map',
    short_name: 'Tango Map',
    description: 'An interactive skill map for Argentine tango — 62 techniques across 10 levels.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5ead8',
    theme_color: '#f5ead8',
    categories: ['education', 'lifestyle', 'sports'],
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'My card',
        short_name: 'My card',
        description: 'Your shareable dancer card',
        url: '/me/card',
        icons: [{ src: '/icon-192', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'My profile',
        short_name: 'Profile',
        description: 'Your progress and Tango DNA',
        url: '/me',
        icons: [{ src: '/icon-192', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
