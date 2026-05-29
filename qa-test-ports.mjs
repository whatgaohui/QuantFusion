import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  const ports = [80, 81, 443, 3000, 8080, 8000, 19001, 19005, 19006, 12600];
  
  for (const port of ports) {
    try {
      const response = await page.goto(`http://127.0.0.1:${port}/`, { timeout: 3000 });
      console.log(`Port ${port}: Status ${response?.status()}`);
      if (response?.ok()) {
        const title = await page.title();
        console.log(`  Title: "${title}"`);
        const html = await page.evaluate(() => document.body?.innerHTML?.substring(0, 200) || 'empty');
        console.log(`  Body: ${html}`);
      }
    } catch (e) {
      console.log(`Port ${port}: ${e.message.substring(0, 60)}`);
    }
  }
  
  await browser.close();
})();
