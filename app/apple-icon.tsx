import { ImageResponse } from 'next/og';
import { iconMark } from '@/src/lib/iconMark';

// Apple touch icon (home-screen icon on iOS) for the app pages.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(iconMark(180), size);
}
