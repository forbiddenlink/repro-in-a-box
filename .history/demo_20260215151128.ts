#!/usr/bin/env tsx
/**
 * Demo script showing the detector framework in action
 */
import { chromium } from '@playwright/test';
import {
  DetectorRegistry,
  JavaScriptErrorsDetector,
  NetworkErrorsDetector,
  BrokenAssetsDetector,
  type DetectorResult
} from './src/detectors/index.js';

async function demo() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Create and register detectors
  const registry = new DetectorRegistry();
  registry.register(new JavaScriptErrorsDetector());
  registry.register(new NetworkErrorsDetector());
  registry.register(new BrokenAssetsDetector());

  console.log('🔍 Registered detectors:', registry.list());
  console.log('');

  // Get all enabled detectors
  const detectors = registry.getEnabled();

  // Setup all detectors
  for (const detector of detectors) {
    await detector.setup?.();
  }

  // Attach all detectors to the page
  for (const detector of detectors) {
    await detector.attach(page);
  }

  // Test with example.com (should be clean)
  console.log('📄 Scanning example.com...');
  await page.goto('https://example.com', { waitUntil: 'networkidle' });

  // Run scan hooks
  for (const detector of detectors) {
    if (detector.scan) {
      await detector.scan(page);
    }
  }

  // Collect results
  const results: DetectorResult[] = [];
  for (const detector of detectors) {
    const result = await detector.collect(page);
    results.push(result);
  }

  // Display results
  console.log('\n📊 Results:');
  for (const result of results) {
    console.log(`\n  ${result.detector}:`);
    console.log(`    Duration: ${result.duration}ms`);
    console.log(`    Issues found: ${result.issues.length}`);
    
    if (result.issues.length > 0) {
      console.log(`    Issues:`);
      for (const issue of result.issues) {
        console.log(`      - [${issue.severity}] ${issue.message}`);
      }
    }
  }

  // Test with a page that has errors (intentionally broken URL)
  console.log('\n\n📄 Scanning a page with broken assets...');
  
  // Create a test HTML page with broken assets
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Page</title>
        <link rel="stylesheet" href="https://example.com/nonexistent.css">
        <script src="https://example.com/nonexistent.js"></script>
      </head>
      <body>
        <h1>Test Page</h1>
        <img src="https://example.com/nonexistent.png" alt="Broken">
        <script>
          // Trigger a console error
          console.error('This is a test error');
          
          // Trigger an unhandled rejection
          Promise.reject(new Error('Test rejection'));
        </script>
      </body>
    </html>
  `);

  // Wait a bit for errors to be captured
  await page.waitForTimeout(1000);

  // Run scan hooks again
  for (const detector of detectors) {
    if (detector.scan) {
      await detector.scan(page);
    }
  }

  // Collect results again
  const results2: DetectorResult[] = [];
  for (const detector of detectors) {
    const result = await detector.collect(page);
    results2.push(result);
  }

  // Display results
  console.log('\n📊 Results:');
  for (const result of results2) {
    console.log(`\n  ${result.detector}:`);
    console.log(`    Duration: ${result.duration}ms`);
    console.log(`    Issues found: ${result.issues.length}`);
    
    if (result.issues.length > 0) {
      console.log(`    Issues:`);
      for (const issue of result.issues) {
        console.log(`      - [${issue.severity}] ${issue.message}`);
        if (issue.details) {
          console.log(`        Details: ${issue.details.substring(0, 100)}...`);
        }
      }
    }
  }

  // Cleanup
  for (const detector of detectors) {
    await detector.cleanup?.();
  }

  await browser.close();
  console.log('\n✅ Demo complete!');
}

// Run the demo
demo().catch(console.error);
