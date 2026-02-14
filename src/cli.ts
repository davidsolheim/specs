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
  .option('--concurrency <group>', 'Set the workflow concurrency group (requires --workflow)')
  .option('--permissions <mode>', 'Set workflow permissions mode (requires --workflow)')
  .option('--job <id>', 'Set the workflow job id (requires --workflow)')
  .option('--job-name <name>', 'Set the workflow job name (requires --workflow)')
  .option('--runs-on <label>', 'Set the workflow job runner (requires --workflow)')
  .option('--working-directory <dir>', 'Set working-directory on the Specs CI step (requires --workflow)')
  .option('--fetch-depth <n>', 'Set actions/checkout fetch-depth (requires --workflow)')
  .option("--timeout-minutes <n>", "Job timeout in minutes")
  .option('--node-version <version>', 'Set the workflow Node.js version (requires --workflow)')
  .option("--manual", "Include workflow_dispatch trigger")
  .option('--pull-request', 'Add a pull_request trigger to the workflow YAML (requires --workflow)')
  .option('--push', 'Add a push trigger to the workflow YAML (requires --workflow)')
  .option('--branch <name>', 'Set the branch for push/pull_request triggers (requires --workflow)')
  .option('--schedule <cron>', 'Add a schedule trigger to the workflow YAML (requires --workflow)')
  .option('--write <file>', 'Write the workflow YAML to a file (requires --workflow)')
  .option('--force', 'Overwrite existing workflow file when used with --write')
  .option('--version <version>', 'Pin the @sitespecs/specs npx package version (default: latest)')
  .action((
    domain: string,
    opts: {
      baseline?: string;
      workflow?: boolean;
      concurrency?: string;
      permissions?: string;
      job?: string;
      jobName?: string;
      runsOn?: string;
      workingDirectory?: string;
      fetchDepth?: string;
      timeoutMinutes?: string;
      nodeVersion?: string;
      manual?: boolean;
      pullRequest?: boolean;
      push?: boolean;
      branch?: string;
      version?: string;
      write?: string;
      force?: boolean;
      schedule?: string;
    }
  ) =>
    ghaCommand(domain, {
      baseline: opts.baseline,
      workflow: opts.workflow,
      concurrency: opts.concurrency,
      permissions: opts.permissions,
      job: opts.job,
      jobName: opts.jobName,
      runsOn: opts.runsOn,
      workingDirectory: opts.workingDirectory,
      fetchDepth: opts.fetchDepth,
      timeoutMinutes: opts.timeoutMinutes,
      nodeVersion: opts.nodeVersion,
      manual: opts.manual,
      pullRequest: opts.pullRequest,
      push: opts.push,
      branch: opts.branch,
      write: opts.write,
      version: opts.version,
      force: opts.force,
      schedule: opts.schedule,
    }),
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
