import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--remote-debugging-port=9222']
  });
  
  // Try creating context with specific permissions
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });
  
  // Grant permissions to localhost
  await context.grantPermissions(['cross-origin-resource-policy'], { origin: 'http://127.0.0.1:3000' });
  
  const page = await context.newPage();
  
  // Try navigating with longer timeout
  try {
    const response = await page.goto('http://127.0.0.1:3000/', { 
      timeout: 60000, 
      waitUntil: 'domcontentloaded'
    });
    console.log(`Response status: ${response?.status()}`);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/home/z/my-project/qa-01-dashboard.png', fullPage: true });
    console.log('Dashboard screenshot saved');
    
    // Get text content
    const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('DASHBOARD TEXT:', text);
  } catch (e) {
    console.log('Navigation failed:', e.message.substring(0, 200));
    
    // Try to use page.route to intercept
    console.log('\nAttempting file:// protocol...');
    
    // Last resort: serve from file
    const html = await fetch('http://127.0.0.1:3000/').then(r => r.text()).catch(() => '');
    if (html) {
      console.log('Got HTML from fetch, length:', html.length);
    }
  }
  
  await browser.close();
})();
