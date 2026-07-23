import './tango.css';

export const metadata = {
  title: 'Tango Map',
  description: 'An interactive skill map for Argentine tango — 62 techniques across 10 levels.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
