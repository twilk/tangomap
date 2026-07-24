/**
 * The app mark used for every generated icon (favicon, apple-touch, PWA
 * manifest): a warm ember disc ringed in carmine on the dark "milonga" ground —
 * a mastered Tango DNA dot. Kept Satori-safe (only background / border /
 * borderRadius / flex) so `next/og` ImageResponse can rasterize it. The disc
 * sits in the centre ~56%, well inside the maskable safe zone.
 */
export function iconMark(size: number) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: '#1a1510',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '56%',
          height: '56%',
          borderRadius: '50%',
          background: '#E58C44',
          border: `${Math.round(size * 0.05)}px solid #E6415C`,
        }}
      />
    </div>
  );
}
