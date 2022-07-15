import { test, expect } from '@playwright/test';

test('npmmirror.com to mirrors', async ({ page }) => {

  // Go to https://npmmirror.com/
  await page.goto('https://npmmirror.com/');

  // Click text=https://npmmirror.com/mirrors/node/
  await page.locator('text=https://npmmirror.com/mirrors/node/').click();
  await expect(page).toHaveURL(/https:\/\/registry.npmmirror.com\/binary.html\?path=node\//);

  // Click text=latest-v0.10.x/
  await page.locator('text=latest-v0.10.x/').click();
  await expect(page).toHaveURL('https://registry.npmmirror.com/binary.html?path=node/latest-v0.10.x/');

});
