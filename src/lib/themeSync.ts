'use client';

// Cross-device custom-theme sync (last-write-wins, client-timestamped). The local
// custom theme is mirrored to profile.customTheme over /api/profile; on load we pull
// the server copy and merge by timestamp. Both directions swallow network/auth errors
// — sync is best-effort and must never break the page (offline, signed-out, private
// mode are all non-fatal). The clock is `tsm-custom-updated`, written by every
// apply/clear/cache in customTheme.ts.

import { currentCustomTheme, customUpdatedAt, cacheCustomTheme, clearCustomTheme } from '@/src/lib/customTheme';

/** Push the local custom theme (and its clock) to the server. No-op-safe. */
export async function pushCustomTheme(): Promise<void> {
  const theme = currentCustomTheme();
  const ts = customUpdatedAt();
  try {
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customTheme: theme,
        customThemeUpdatedAt: new Date(ts).toISOString(),
      }),
    });
  } catch {
    /* offline / 401 / storage-less — sync is best-effort, never fatal */
  }
}

/** Pull the server custom theme and merge it against the local one by timestamp:
 *  server newer → cache it (or clear, if the server cleared); local newer → push. */
export async function pullAndMergeTheme(): Promise<void> {
  try {
    const res = await fetch('/api/profile', { method: 'GET' });
    if (res.status !== 200) return; // 401 (signed out) and any error: nothing to merge
    const dto = await res.json();
    const serverTs = dto.customThemeUpdatedAt ? Date.parse(dto.customThemeUpdatedAt) : 0;
    const localTs = customUpdatedAt();
    if (serverTs > localTs) {
      if (dto.customTheme) cacheCustomTheme(dto.customTheme, serverTs);
      else clearCustomTheme(serverTs);
    } else if (localTs > serverTs) {
      await pushCustomTheme();
    }
  } catch {
    /* offline / malformed — best-effort, never fatal */
  }
}
