import { chromium } from 'playwright';

(async () => {
  // Try launching with specific args to avoid network isolation
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ]
  });
  
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // Try different URLs
  const urls = [
    'http://127.0.0.1:3000/',
    'http://localhost:3000/',
    'http://21.0.4.63:3000/',
    'http://0.0.0.0:3000/',
  ];
  
  for (const url of urls) {
    try {
      console.log(`Trying ${url}...`);
      const response = await page.goto(url, { timeout: 5000 });
      console.log(`SUCCESS! Status: ${response?.status()}`);
      break;
    } catch (e) {
      console.log(`Failed: ${e.message.substring(0, 80)}`);
    }
  }
  
  await browser.close();
})();
