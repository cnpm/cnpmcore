import { test, expect } from '@playwright/test';

test('binary.html', async ({ page }) => {

  // Go to https://registry.npmmirror.com/binary.html
  await page.goto('https://registry.npmmirror.com/binary.html');

  // Click text=playwright/
  await page.locator('text=playwright/').click();
  await expect(page).toHaveURL('https://registry.npmmirror.com/binary.html?path=playwright/');

  // Click text=builds/
  await page.locator('text=builds/').click();
  await expect(page).toHaveURL('https://registry.npmmirror.com/binary.html?path=playwright/builds/');

  // Click text=chromium/
  await page.locator('text=chromium/').click();
  await expect(page).toHaveURL('https://registry.npmmirror.com/binary.html?path=playwright/builds/chromium/');

  // Click text=1005/
  await page.locator('text=1005/').click();
  await expect(page).toHaveURL('https://registry.npmmirror.com/binary.html?path=playwright/builds/chromium/1005/');

  // Click text=Parent Directory
  await page.locator('text=Parent Directory').click();
  await expect(page).toHaveURL('https://registry.npmmirror.com/binary.html?path=playwright/builds/chromium/');

});

