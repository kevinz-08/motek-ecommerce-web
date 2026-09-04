import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

const firstCard = page.locator('a[href^="/producto/"]').first();
await firstCard.hover();
await page.waitForTimeout(300);
const addBtn = firstCard.locator('button[aria-label^="Agregar"]');
if (await addBtn.count() > 0) {
  await addBtn.click({ force: true });
  await page.waitForTimeout(500);
}

await page.screenshot({ path: 'C:\\Users\\pagin\\AppData\\Local\\Temp\\cart-fixed-desktop.png', clip: { x: 1250, y: 0, width: 190, height: 90 } });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
const firstCardM = mobile.locator('a[href^="/producto/"]').first();
await firstCardM.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const addBtnM = firstCardM.locator('button[aria-label^="Agregar"]');
await firstCardM.hover({ force: true }).catch(() => {});
if (await addBtnM.count() > 0) {
  await addBtnM.click({ force: true });
  await mobile.waitForTimeout(500);
}
await mobile.screenshot({ path: 'C:\\Users\\pagin\\AppData\\Local\\Temp\\cart-fixed-mobile.png', clip: { x: 0, y: 0, width: 390, height: 70 } });

await browser.close();
console.log('done');
