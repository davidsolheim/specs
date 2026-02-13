#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze';

const program = new Command();

program
  .name('specs')
  .description('Analyze website tech stack, hosting, and performance')
  .version('0.1.0');

program
  .argument('<domain>', 'Domain to analyze (e.g., example.com)')
  .option('-v, --verbose', 'Show detailed information')
  .option('-j, --json', 'Output as JSON')
  .option('--profile <ci|report>', 'Apply preset defaults (ci: summary-json + fail-on-diff when --diff, report: verbose)')
  .option('--summary', 'Print a single-line CI/log-friendly summary (overrides other output modes)')
  .option(
    '--summary-json',
    'Print a single-line JSON verdict summary (overrides other output modes and prints exactly one stdout line)'
  )
  .option('--save <path>', 'Save the raw analysis JSON to a file')
  .option('--diff <path>', 'Compare against a baseline analysis JSON file (summary mode only)')
  .option(
    '--top-changes <n>',
    'In --summary --diff mode, include the top N changed/added/removed leaf paths (lexicographic)',
    (value: string) => parseInt(value, 10)
  )
  .option('--fail-on-diff', 'Exit 1 when drift is detected (requires --summary --diff)')
  .option('--tech', 'Show only technology stack')
  .option('--seo', 'Show only SEO information')
  .option('--performance', 'Show only performance metrics')
  .option('--hosting', 'Show only hosting information')
  .action(analyzeCommand);

program.parse();
