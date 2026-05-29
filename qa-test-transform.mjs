import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // Try with XTransformPort query parameter
  console.log('Trying with XTransformPort=3000...');
  try {
    const response = await page.goto('http://127.0.0.1:81/?XTransformPort=3000', { timeout: 30000, waitUntil: 'networkidle' });
    console.log(`Status: ${response?.status()}`);
    await page.waitForTimeout(5000);
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || 'empty');
    console.log('BODY:', bodyText);
  } catch (e) {
    console.log('Error:', e.message.substring(0, 200));
  }
  
  await browser.close();
})();
