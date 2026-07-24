import { ImageResponse } from 'next/og';
import { iconMark } from '@/src/lib/iconMark';

// 512px PWA icon at a stable URL (/icon-512) for the manifest (any + maskable).
export function GET() {
  return new ImageResponse(iconMark(512), { width: 512, height: 512 });
}
