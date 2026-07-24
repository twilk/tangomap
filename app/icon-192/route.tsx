import { ImageResponse } from 'next/og';
import { iconMark } from '@/src/lib/iconMark';

// 192px PWA icon at a stable URL (/icon-192) for the manifest + the static map.
export function GET() {
  return new ImageResponse(iconMark(192), { width: 192, height: 192 });
}
