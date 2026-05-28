import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // Navigate via Caddy proxy on port 81
  console.log('Opening app via Caddy proxy (port 81)...');
  const response = await page.goto('http://127.0.0.1:81/', { timeout: 30000, waitUntil: 'networkidle' });
  console.log(`Status: ${response?.status()}`);
  
  await page.waitForTimeout(5000);
  
  const title = await page.title();
  console.log(`Title: "${title}"`);
  
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 3000) || 'empty');
  console.log('BODY TEXT:');
  console.log(bodyText);
  
  await page.screenshot({ path: '/home/z/my-project/qa-01-dashboard.png' });
  console.log('Screenshot saved');
  
  await browser.close();
})();
