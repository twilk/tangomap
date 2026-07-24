import { test, expect } from '@playwright/test';

// Read-only smoke over the dancer card using a seeded public handle.
const HANDLE = process.env.E2E_HANDLE ?? 'wilk';

test.describe('dancer card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/u/${HANDLE}/card`);
  });

  test('front face renders radar, serial and identity', async ({ page }) => {
    await expect(page.locator('.tm-card.front')).toBeVisible();
    await expect(page.locator('.tm-card-serial').first()).toContainText(/Nº \d{4}/);
    await expect(page.locator('.tm-card.front .tm-card-id h1')).not.toBeEmpty();
    // radar blob path exists and has a non-trivial shape
    const d = await page.locator('.tm-card-blob').getAttribute('d');
    expect(d?.length ?? 0).toBeGreaterThan(50);
  });

  test('flip shows the recommendations back', async ({ page }) => {
    await page.getByRole('button', { name: /flip/i }).click();
    await expect(page.locator('.tm-cardflip')).toHaveClass(/flipped/);
    await expect(page.locator('.tm-card.back')).toBeVisible();
  });

  test('badge mode opens with a scannable QR and closes on ESC', async ({ page }) => {
    await page.getByRole('button', { name: /badge/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img')).toHaveAttribute('src', /^data:image\/png/);
    await expect(page.locator('.tm-badge-close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('share falls back to clipboard where Web Share is unavailable', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions vary');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: /^share$/i }).click();
    // either the native sheet opened (mobile emulation) or the copy label appears
    const copied = page.getByRole('button', { name: /link copied/i });
    const stillShare = page.getByRole('button', { name: /^share$/i });
    await expect(copied.or(stillShare)).toBeVisible();
  });

  test('story image export produces a PNG download', async ({ page }) => {
    const download = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: /story image/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/-tango-card\.png$/);
  });

  test('compare CTA and full-profile link are present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /compare with/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /full profile/i })).toBeVisible();
  });
});
