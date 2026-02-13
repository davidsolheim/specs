import ora from 'ora';
import chalk from 'chalk';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchAnalysis, type AnalysisResponse } from '../lib/api';
import { computeJsonDriftCounts, computeJsonDriftDetails } from '../lib/json-diff';
import { formatOutput } from '../lib/formatter';

interface AnalyzeOptions {
  verbose?: boolean;
  json?: boolean;
  summary?: boolean;
  summaryJson?: boolean;
  diff?: string;
  topChanges?: number;
  failOnDiff?: boolean;
  tech?: boolean;
  seo?: boolean;
  performance?: boolean;
  hosting?: boolean;
  save?: string;
}

async function saveAnalysisJson(savePath: string, data: unknown) {
  await mkdir(dirname(savePath), { recursive: true });
  await writeFile(savePath, JSON.stringify(data, null, 2), 'utf8');
}

type SummaryJsonOutput = {
  ok: boolean;
  domain: string;
  drift_changed: number;
  drift_added: number;
  drift_removed: number;
  top_changed?: string[];
  top_added?: string[];
  top_removed?: string[];
  exit: number;
  error: string | null;
};

export async function analyzeCommand(domain: string, options: AnalyzeOptions) {
  // Normalize domain
  const normalizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

  if (options.summaryJson) {
    const baselinePath = options.diff;

    const emit = (out: SummaryJsonOutput) => {
      // Must be exactly one line on stdout with no additional noise.
      console.log(JSON.stringify(out));
    };

    const exitWith = (out: SummaryJsonOutput) => {
      emit(out);
      if (out.exit !== 0) process.exit(out.exit);
    };

    const baseOut = (overrides: Partial<SummaryJsonOutput>): SummaryJsonOutput => ({
      ok: false,
      domain: normalizedDomain,
      drift_changed: 0,
      drift_added: 0,
      drift_removed: 0,
      exit: 1,
      error: null,
      ...overrides,
    });

    const topN = options.topChanges;
    if (topN !== undefined) {
      if (!Number.isInteger(topN) || topN <= 0) {
        exitWith(
          baseOut({
            ok: false,
            exit: 2,
            error: `invalid_top_changes: ${String(topN)}`,
          })
        );
        return;
      }
      if (!baselinePath) {
        exitWith(baseOut({ ok: false, exit: 2, error: 'baseline_missing' }));
        return;
      }
    }

    if (options.failOnDiff && !baselinePath) {
      exitWith(baseOut({ ok: false, exit: 2, error: 'baseline_missing' }));
      return;
    }

    let baselineJson: unknown | undefined;
    if (baselinePath) {
      let raw: string;
      try {
        raw = await readFile(baselinePath, 'utf8');
      } catch {
        exitWith(baseOut({ ok: false, exit: 2, error: `baseline_missing: ${baselinePath}` }));
        return;
      }

      try {
        baselineJson = JSON.parse(raw);
      } catch {
        exitWith(baseOut({ ok: false, exit: 2, error: `baseline_parse_error: ${baselinePath}` }));
        return;
      }
    }

    let data: unknown;
    try {
      data = await fetchAnalysis(normalizedDomain);
    } catch (error) {
      exitWith(baseOut({ ok: false, exit: 1, error: 'api_error' }));
      return;
    }

    if (options.save) {
      try {
        await saveAnalysisJson(options.save, data);
      } catch {
        exitWith(baseOut({ ok: false, exit: 2, error: `save_error: ${options.save}` }));
        return;
      }
    }

    if (baselinePath) {
      const { changed, added, removed } = computeJsonDriftCounts(baselineJson, data);
      const drift = changed + added + removed;
      const exit = options.failOnDiff && drift > 0 ? 1 : 0;

      const out: SummaryJsonOutput = {
        ok: exit === 0,
        domain: normalizedDomain,
        exit,
        drift_changed: changed,
        drift_added: added,
        drift_removed: removed,
        error: null,
      };

      if (topN !== undefined) {
        const details = computeJsonDriftDetails(baselineJson, data);
        out.top_changed = details.changedPaths.slice(0, topN);
        out.top_added = details.addedPaths.slice(0, topN);
        out.top_removed = details.removedPaths.slice(0, topN);
      }

      exitWith(out);
      return;
    }

    emit(
      baseOut({
        ok: true,
        exit: 0,
        error: null,
      })
    );
    return;
  }

  if (options.summary) {
    let baselineJson: unknown | undefined;

    if (options.diff) {
      if (options.topChanges !== undefined) {
        const n = options.topChanges;
        if (!Number.isInteger(n) || n <= 0) {
          console.log(`SUMMARY ${normalizedDomain} exit=2`);
          process.exit(2);
        }
      }

      try {
        const raw = await readFile(options.diff, 'utf8');
        baselineJson = JSON.parse(raw);
      } catch {
        console.log(`SUMMARY ${normalizedDomain} exit=2`);
        process.exit(2);
      }
    }

    try {
      const data = await fetchAnalysis(normalizedDomain);

      if (options.save) {
        try {
          await saveAnalysisJson(options.save, data);
        } catch {
          console.log(`SUMMARY ${normalizedDomain} exit=2`);
          process.exit(2);
        }
      }

      const status = data.status;
      const tech = Array.isArray(data.technologies) ? data.technologies.length : 0;
      const seo = (data as AnalysisResponse).seo?.score ?? 'na';
      const hosting = (data as AnalysisResponse).host ?? 'na';
      const perf = 'na';

      if (options.diff) {
        const { changed, added, removed } = computeJsonDriftCounts(baselineJson, data);
        const drift = changed + added + removed;
        const exit = options.failOnDiff && drift > 0 ? 1 : 0;

        let extra = '';
        if (options.topChanges !== undefined) {
          const n = options.topChanges;
          const details = computeJsonDriftDetails(baselineJson, data);
          const topChanged = details.changedPaths.slice(0, n).join(',');
          const topAdded = details.addedPaths.slice(0, n).join(',');
          const topRemoved = details.removedPaths.slice(0, n).join(',');
          extra = ` top_changed=${topChanged} top_added=${topAdded} top_removed=${topRemoved}`;
        }

        console.log(
          `SUMMARY ${data.domain} status=${status} tech=${tech} seo=${seo} perf=${perf} hosting=${hosting} drift_changed=${changed} drift_added=${added} drift_removed=${removed} exit=${exit}${extra}`
        );

        if (exit !== 0) process.exit(exit);
        return;
      }

      console.log(
        `SUMMARY ${data.domain} status=${status} tech=${tech} seo=${seo} perf=${perf} hosting=${hosting}`
      );
      return;
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`\n✗ ${error.message}`));

        if (error.message.includes('API error')) {
          console.log(chalk.gray('\nTip: Check your internet connection or try again later.'));
        }
      } else {
        console.error(chalk.red('\n✗ An unexpected error occurred'));
      }

      process.exit(1);
    }
  }

  const spinner = ora(`Analyzing ${chalk.cyan(normalizedDomain)}...`).start();

  try {
    // Fetch analysis from API
    const data = await fetchAnalysis(normalizedDomain);

    if (options.save) {
      try {
        await saveAnalysisJson(options.save, data);
      } catch (error) {
        spinner.fail(chalk.red('Analysis failed'));
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\n✗ Failed to save analysis JSON to ${options.save}: ${message}`));
        process.exit(1);
      }
    }
    
    spinner.succeed(chalk.green(`Analysis complete for ${chalk.bold(data.domain)}`));
    
    // Output as JSON if requested
    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    
    // Format and display output
    formatOutput(data, options);
    
    // Show analyzing message if data is being refreshed
    if (data.analyzing) {
      console.log();
      console.log(chalk.yellow('⚡ Fresh analysis in progress... Run this command again in a few seconds for updated results.'));
    }
    
  } catch (error) {
    spinner.fail(chalk.red('Analysis failed'));
    
    if (error instanceof Error) {
      console.error(chalk.red(`\n✗ ${error.message}`));
      
      if (error.message.includes('API error')) {
        console.log(chalk.gray('\nTip: Check your internet connection or try again later.'));
      }
    } else {
      console.error(chalk.red('\n✗ An unexpected error occurred'));
    }
    
    process.exit(1);
  }
}
