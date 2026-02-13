#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze';
import { baselineCommand } from './commands/baseline';
import { ciCommand } from "./commands/ci";
import { ghaCommand } from './commands/gha';

const program = new Command();

program
  .name('specs')
  .description('Analyze website tech stack, hosting, and performance')
  .version('0.1.0');

program
  .command('baseline')
  .description('Save raw analysis JSON to a baseline file')
  .argument('<domain>', 'Domain to baseline (e.g., example.com)')
  .option('--stdout', 'Write raw baseline JSON to stdout')
  .option('--out <path>', 'Path to write the baseline JSON file')
  .option('--force', 'Overwrite an existing baseline file (file mode only; usage: baseline --out <path> --force)')
  .option('--profile <ci|report>', 'Rejected for baseline (usage error)')
  .action((domain: string, options: { out?: string; profile?: string; force?: boolean; stdout?: boolean }) =>
    baselineCommand(domain, options)
  );

program
  .command("ci")
  .description("Run CI analysis with baseline diff")
  .argument("<domain>")
  .option("--baseline <path>")
  .action((domain: string, opts: { baseline?: string }) => ciCommand(domain, { baseline: opts.baseline }));

program
  .command('gha')
  .description('Print a copy/paste GitHub Actions step snippet for specs ci')
  .argument('<domain>', 'Domain to analyze in CI (e.g., example.com)')
  .option('--baseline <path>', 'Path to a baseline analysis JSON file')
  .option('--workflow', 'Print a full GitHub Actions workflow YAML')
  .option('--version <version>', 'Pin the @sitespecs/specs npx package version (default: latest)')
  .action((
    domain: string,
    opts: { baseline?: string; workflow?: boolean; version?: string }
  ) =>
    ghaCommand(domain, { baseline: opts.baseline, workflow: opts.workflow, version: opts.version }),
  );

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
