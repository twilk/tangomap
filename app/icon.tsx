import { ImageResponse } from 'next/og';
import { iconMark } from '@/src/lib/iconMark';

// Favicon for the app pages (auto-linked by Next on every /app route).
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(iconMark(64), size);
}
