import { Command } from 'commander';
import inquirer from 'inquirer';
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { ReproConfig } from '../../config/index.js';

/**
 * Init command: Interactive configuration wizard
 * Creates .reprorc.json with user preferences
 */

export const initCommand = new Command('init')
  .description('Create a configuration file interactively')
  .option('-o, --output <path>', 'Output path for config file', '.reprorc.json')
  .option('--json', 'Output as JSON (default)')
  .option('--js', 'Output as JavaScript module')
  .action(async (options) => {
    console.log('🎯 Repro-in-a-Box Configuration Wizard\n');
    
    // Interactive prompts
    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'detectors',
        message: 'Which detectors do you want to enable?',
        choices: [
          { name: 'JavaScript Errors', value: 'javascript-errors', checked: true },
          { name: 'Network Errors', value: 'network-errors', checked: true },
          { name: 'Broken Assets', value: 'broken-assets', checked: true },
          { name: 'Accessibility (WCAG 2.1)', value: 'accessibility', checked: true },
          { name: 'Web Vitals (Core Web Vitals)', value: 'web-vitals', checked: true },
          { name: 'Mixed Content (HTTP/HTTPS)', value: 'mixed-content', checked: false },
          { name: 'Broken Links', value: 'broken-links', checked: false },
        ],
      },
      {
        type: 'number',
        name: 'maxDepth',
        message: 'Maximum crawl depth (1-10):',
        default: 3,
        validate: (input: number) => input >= 1 && input <= 10 || 'Must be between 1 and 10',
      },
      {
        type: 'number',
        name: 'maxPages',
        message: 'Maximum pages to scan (1-1000):',
        default: 100,
        validate: (input: number) => input >= 1 && input <= 1000 || 'Must be between 1 and 1000',
      },
      {
        type: 'number',
        name: 'rateLimit',
        message: 'Delay between requests in ms (0-5000):',
        default: 100,
        validate: (input: number) => input >= 0 && input <= 5000 || 'Must be between 0 and 5000',
      },
      {
        type: 'list',
        name: 'outputFormat',
        message: 'Preferred output format:',
        choices: ['json', 'text', 'csv', 'html'],
        default: 'json',
      },
      {
        type: 'confirm',
        name: 'verbose',
        message: 'Enable verbose logging?',
        default: false,
      },
      {
        type: 'number',
        name: 'minReproducibility',
        message: 'Minimum reproducibility score (0-100):',
        default: 70,
        validate: (input: number) => input >= 0 && input <= 100 || 'Must be between 0 and 100',
      },
      {
        type: 'confirm',
        name: 'bundleEnabled',
        message: 'Create reproducible bundles by default?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'includeScreenshots',
        message: 'Include screenshots in bundles?',
        default: true,
        when: (answers: any) => answers.bundleEnabled,
      },
    ]);
    
    // Build config object
    const config: Partial<ReproConfig> = {
      detectors: {
        enabled: answers.detectors,
      },
      crawler: {
        maxDepth: answers.maxDepth,
        maxPages: answers.maxPages,
        rateLimit: answers.rateLimit,
      },
      output: {
        format: answers.outputFormat,
        verbose: answers.verbose,
      },
      thresholds: {
        minReproducibility: answers.minReproducibility,
      },
      bundle: {
        enabled: answers.bundleEnabled,
        includeScreenshots: answers.includeScreenshots !== false,
      },
    };
    
    // Determine output path
    let outputPath = options.output;
    if (options.js) {
      outputPath = outputPath.replace(/\.json$/, '.js');
    }
    
    // Generate file content
    let content: string;
    if (options.js || outputPath.endsWith('.js')) {
      // JavaScript module
      content = `export default ${JSON.stringify(config, null, 2)};\n`;
    } else {
      // JSON file
      content = JSON.stringify(config, null, 2) + '\n';
    }
    
    // Write config file
    writeFileSync(join(process.cwd(), outputPath), content, 'utf-8');
    
    console.log(`\n✅ Configuration saved to ${outputPath}`);
    console.log('\nYou can now run:');
    console.log('  repro scan https://example.com');
    console.log('\nConfig file will be loaded automatically!');
  });
