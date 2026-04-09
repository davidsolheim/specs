#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze.js';
import { baselineCommand } from './commands/baseline.js';
import { ciCommand } from "./commands/ci.js";
import { ghaCommand } from './commands/gha.js';

const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageVersion = JSON.parse(readFileSync(packageJsonPath, 'utf8')).version as string;
const program = new Command();

program
  .name('specs')
  .description('Analyze website tech stack, hosting, and performance')
  .version(packageVersion);

program
  .command('baseline')
  .description('Save raw analysis JSON to a baseline file')
  .argument('<domain>', 'Domain to baseline (e.g., example.com)')
  .option('--mode <local|cloud>', 'Analysis execution mode', 'local')
  .option('--enrich', 'Attach optional SiteSpecs cloud enrichment to the local analysis result')
  .option('--stdout', 'Write raw baseline JSON to stdout')
  .option('--out <path>', 'Path to write the baseline JSON file')
  .option('--force', 'Overwrite an existing baseline file (file mode only; usage: baseline --out <path> --force)')
  .option('--profile <ci|report>', 'Rejected for baseline (usage error)')
  .action((domain: string, options: { out?: string; profile?: string; force?: boolean; stdout?: boolean; mode?: string; enrich?: boolean }) =>
    baselineCommand(domain, options)
  );

program
  .command("ci")
  .description("Run CI analysis with baseline diff")
  .argument("<domain>")
  .option('--mode <local|cloud>', 'Analysis execution mode', 'local')
  .option('--enrich', 'Attach optional SiteSpecs cloud enrichment to the local analysis result')
  .option("--baseline <path>")
  .option("--save [path]", "Save the raw analysis JSON to a file")
  .option('--fail-on-diff', 'Exit 1 when drift is detected (recommended for CI gating)')
  .action((
    domain: string,
    opts: { baseline?: string; mode?: string; enrich?: boolean; save?: string | boolean; failOnDiff?: boolean }
  ) =>
    ciCommand(domain, {
      baseline: opts.baseline,
      mode: opts.mode,
      enrich: opts.enrich,
      save: typeof opts.save === 'string' ? opts.save : undefined,
      saveFlagPresent: opts.save !== undefined,
      failOnDiff: opts.failOnDiff,
    }),
  );

program
  .command('gha')
  .description('Print a copy/paste GitHub Actions step snippet for specs ci')
  .argument('<domain>', 'Domain to analyze in CI (e.g., example.com)')
  .option('--baseline <path>', 'Path to a baseline analysis JSON file')
  .option('--mode <local|cloud>', 'Analysis execution mode to encode in the snippet', 'local')
  .option('--enrich', 'Encode optional SiteSpecs cloud enrichment in the snippet/workflow')
  .option('--workflow', 'Print a full GitHub Actions workflow YAML')
  .option('--artifact <path>', 'Upload analysis JSON as a workflow artifact (requires --workflow)')
  .option('--artifact-retention-days <n>', 'Set upload-artifact retention-days (requires --workflow and --artifact)')
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
  .option(
    '--version <version>',
    'Pin the @sitespecs/specs npx package version (default: current release channel, e.g. next for prerelease builds)'
  )
  .action((
    domain: string,
    opts: {
      baseline?: string;
      mode?: string;
      enrich?: boolean;
      workflow?: boolean;
      artifact?: string;
      artifactRetentionDays?: string;
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
      mode: opts.mode,
      enrich: opts.enrich,
      workflow: opts.workflow,
      artifact: opts.artifact,
      artifactRetentionDays: opts.artifactRetentionDays,
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
      cliVersion: packageVersion,
      force: opts.force,
      schedule: opts.schedule,
    }),
  );

program
  .argument('<domain>', 'Domain to analyze (e.g., example.com)')
  .option('--mode <local|cloud>', 'Analysis execution mode', 'local')
  .option('--enrich', 'Attach optional SiteSpecs cloud enrichment to the local analysis result')
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
  .option('--trend <path>', 'Compare current drift counts against a previous summary JSON verdict (requires --diff and summary mode)')
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
