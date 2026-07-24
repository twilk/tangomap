'use client';

// Mounts once in the app shell (app/layout.tsx). On load it pulls the server-stored
// custom theme and merges it into localStorage (last-write-wins), so a user's custom
// palette follows them across devices. Renders nothing.

import { useEffect } from 'react';
import { pullAndMergeTheme } from '@/src/lib/themeSync';

export function ThemeSync() {
  useEffect(() => {
    void pullAndMergeTheme();
  }, []);
  return null;
}
