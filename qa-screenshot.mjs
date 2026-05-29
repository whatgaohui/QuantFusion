import { chromium } from 'playwright';

const views = [
  { name: 'dashboard', path: '/', wait: 3000 },
  { name: 'agent-chat', path: '/', nav: 'agent-chat', wait: 3000 },
  { name: 'signal-scanner', path: '/', nav: 'signal-scanner', wait: 3000 },
  { name: 'positions', path: '/', nav: 'positions', wait: 3000 },
  { name: 'strategy-center', path: '/', nav: 'strategy-center', wait: 3000 },
  { name: 'market-news', path: '/', nav: 'market-news', wait: 3000 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  // Navigate to the app
  console.log('Opening app...');
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Screenshot 1: Dashboard
  console.log('Taking dashboard screenshot...');
  await page.screenshot({ path: '/home/z/my-project/qa-01-dashboard.png', fullPage: false });
  console.log('Dashboard screenshot taken');
  
  // Get dashboard text content for analysis
  const dashboardText = await page.evaluate(() => document.body.innerText);
  console.log('DASHBOARD TEXT (first 2000 chars):');
  console.log(dashboardText.substring(0, 2000));
  console.log('---END DASHBOARD---');
  
  // Now navigate to different views using the sidebar
  // First, let's find the sidebar navigation items
  const navItems = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-sidebar-item], nav a, .sidebar a, [role="tab"]');
    return Array.from(items).map(el => ({ text: el.textContent?.trim(), tag: el.tagName, href: el.getAttribute('href'), class: el.className.substring(0, 100) }));
  });
  console.log('NAV ITEMS:', JSON.stringify(navItems, null, 2));
  
  // Try clicking through each view
  const viewNames = ['agent-chat', 'signal-scanner', 'positions', 'strategy-center', 'market-news'];
  
  for (const view of viewNames) {
    try {
      console.log(`\nNavigating to ${view}...`);
      // Try to find and click the sidebar item
      const clicked = await page.evaluate((viewName) => {
        const allElements = document.querySelectorAll('button, a, [role="button"], [role="tab"]');
        for (const el of allElements) {
          const text = el.textContent?.trim().toLowerCase() || '';
          const dataAttr = el.getAttribute('data-view') || el.getAttribute('data-nav') || '';
          if (text.includes(viewName) || dataAttr === viewName) {
            el.click();
            return text;
          }
        }
        return null;
      }, view);
      
      if (clicked) {
        console.log(`Clicked: "${clicked}"`);
      } else {
        console.log(`Could not find nav item for ${view}`);
      }
      
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `/home/z/my-project/qa-${view}.png`, fullPage: false });
      
      const viewText = await page.evaluate(() => document.body.innerText);
      console.log(`${view.toUpperCase()} TEXT (first 1500 chars):`);
      console.log(viewText.substring(0, 1500));
      console.log(`---END ${view.toUpperCase()}---`);
    } catch (e) {
      console.log(`Error with ${view}: ${e.message}`);
    }
  }
  
  await browser.close();
  console.log('\nDone! All screenshots saved.');
})();
