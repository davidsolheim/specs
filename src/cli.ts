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
  .option('--summary', 'Print a single-line CI/log-friendly summary (overrides other output modes)')
  .option('--tech', 'Show only technology stack')
  .option('--seo', 'Show only SEO information')
  .option('--performance', 'Show only performance metrics')
  .option('--hosting', 'Show only hosting information')
  .action(analyzeCommand);

program.parse();
