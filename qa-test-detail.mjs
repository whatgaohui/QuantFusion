import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // Port 81 - Caddy
  try {
    console.log('=== Port 81 (Caddy) ===');
    const response = await page.goto('http://127.0.0.1:81/', { timeout: 15000, waitUntil: 'domcontentloaded' });
    console.log(`Status: ${response?.status()}`);
    await page.waitForTimeout(3000);
    const title = await page.title();
    console.log(`Title: "${title}"`);
    const html = await page.evaluate(() => document.body?.innerHTML?.substring(0, 500) || 'empty');
    console.log(`Body: ${html}`);
  } catch (e) {
    console.log(`Error: ${e.message.substring(0, 200)}`);
  }
  
  // Port 8000 - Python (ai-service)
  try {
    console.log('\n=== Port 8000 (AI Service) ===');
    const response = await page.goto('http://127.0.0.1:8000/', { timeout: 15000, waitUntil: 'domcontentloaded' });
    console.log(`Status: ${response?.status()}`);
    const html = await page.evaluate(() => document.body?.innerHTML?.substring(0, 500) || 'empty');
    console.log(`Body: ${html}`);
  } catch (e) {
    console.log(`Error: ${e.message.substring(0, 200)}`);
  }
  
  await browser.close();
})();
