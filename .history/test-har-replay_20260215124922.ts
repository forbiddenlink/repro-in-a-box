import { chromium } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TestResult {
  url: string;
  recorded: boolean;
  replays: {
    attempt: number;
    success: boolean;
    error?: string;
    duration: number;
  }[];
  successRate: number;
}

async function testSite(url: string, siteId: string): Promise<TestResult> {
  const harPath = path.resolve(process.cwd(), 'test-hars', `${siteId}.har`);
  const result: TestResult = {
    url,
    recorded: false,
    replays: [],
    successRate: 0
  };

  try {
    // Step 1: Record HAR
    console.log(`\n📹 Recording ${url}...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    await context.routeFromHAR(harPath, {
      url: '**/*',
      update: true,
      updateContent: 'embed',
      updateMode: 'full'
    });

    const page = await context.newPage();
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    // Scroll to trigger lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    
    await browser.close();
    result.recorded = true;
    console.log(`✅ HAR recorded: ${harPath}`);

    // Step 2: Replay 3x
    for (let i = 1; i <= 3; i++) {
      console.log(`\n🔄 Replay attempt ${i}/3...`);
      const startTime = Date.now();
      
      const replayBrowser = await chromium.launch({ headless: true });
      const replayContext = await replayBrowser.newContext();
      
      await replayContext.routeFromHAR(harPath, {
        url: '**/*',
        notFound: 'fallback',
        update: false
      });

      const replayPage = await replayContext.newPage();
      
      try {
        await replayPage.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });
        
        const duration = Date.now() - startTime;
        result.replays.push({
          attempt: i,
          success: true,
          duration
        });
        console.log(`✅ Success (${duration}ms)`);
      } catch (error: any) {
        const duration = Date.now() - startTime;
        result.replays.push({
          attempt: i,
          success: false,
          error: error.message,
          duration
        });
        console.log(`❌ Failed: ${error.message}`);
      }
      
      await replayBrowser.close();
    }

    // Calculate success rate
    const successes = result.replays.filter(r => r.success).length;
    result.successRate = successes / result.replays.length;

  } catch (error: any) {
    console.error(`❌ Critical error testing ${url}:`, error.message);
  }

  return result;
}

async function main() {
  // Create test-hars directory
  await fs.mkdir('./test-hars', { recursive: true });

  const testSites = [
    { url: 'https://example.com', id: 'example' },
    { url: 'https://github.com', id: 'github' },
    { url: 'https://news.ycombinator.com', id: 'hn' },
    { url: 'https://stackoverflow.com', id: 'stackoverflow' },
    { url: 'https://playwright.dev', id: 'playwright' },
    { url: 'https://vercel.com', id: 'vercel' },
    { url: 'https://stripe.com/docs', id: 'stripe' },
    { url: 'https://developer.mozilla.org', id: 'mdn' },
    { url: 'https://reddit.com', id: 'reddit' },
    { url: 'https://npmjs.com', id: 'npm' }
  ];

  console.log('🚀 HAR Replay Validation Test');
  console.log('=============================\n');

  const results: TestResult[] = [];

  for (const site of testSites) {
    const result = await testSite(site.url, site.id);
    results.push(result);
  }

  // Print summary
  console.log('\n\n📊 SUMMARY');
  console.log('==========\n');

  const summaryTable = results.map(r => {
    const status = r.successRate >= 0.7 ? '✅' : r.successRate >= 0.5 ? '⚠️' : '❌';
    return {
      Status: status,
      Site: r.url,
      'Success Rate': `${(r.successRate * 100).toFixed(0)}%`,
      Recorded: r.recorded ? 'Yes' : 'No'
    };
  });

  console.table(summaryTable);

  // Calculate overall stats
  const totalSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
  const sitesAbove70 = results.filter(r => r.successRate >= 0.7).length;

  console.log(`\nOverall Success Rate: ${(totalSuccessRate * 100).toFixed(1)}%`);
  console.log(`Sites with ≥70% success: ${sitesAbove70}/${results.length}`);

  // Decision
  console.log('\n🎯 DECISION');
  console.log('===========\n');

  if (totalSuccessRate >= 0.7) {
    console.log('✅ HAR replay is VIABLE');
    console.log('→ Proceed with original plan (page.routeFromHAR)');
  } else if (totalSuccessRate >= 0.5) {
    console.log('⚠️ HAR replay is MARGINAL');
    console.log('→ Consider MSW fallback for problematic sites');
  } else {
    console.log('❌ HAR replay is NOT VIABLE');
    console.log('→ Use Mock Service Worker (MSW) for determinism');
  }

  // Save detailed results
  await fs.writeFile(
    './har-validation-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\n💾 Detailed results saved to: har-validation-results.json');
}

main().catch(console.error);
