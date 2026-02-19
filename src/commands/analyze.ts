import ora from 'ora';
import chalk from 'chalk';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchAnalysis, type AnalysisResponse } from '../lib/api.js';
import { computeJsonDriftCounts, computeJsonDriftDetails } from '../lib/json-diff.js';
import { formatOutput } from '../lib/formatter.js';

interface AnalyzeOptions {
  verbose?: boolean;
  json?: boolean;
  summary?: boolean;
  summaryJson?: boolean;
  profile?: string;
  diff?: string;
  trend?: string;
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
  trend_delta_changed?: number;
  trend_delta_added?: number;
  trend_delta_removed?: number;
  top_changed?: string[];
  top_added?: string[];
  top_removed?: string[];
  exit: number;
  error: string | null;
};

function classifyFetchFailure(message: string): 'rate_limited' | 'upstream_unavailable' | 'api_error' {
  if (message.startsWith('Rate limited:')) return 'rate_limited';

  if (
    /^API error: (408|500|502|503|504|520|521|522|523|524|525|526|527|528|530)\b/.test(message) ||
    message.startsWith('DNS temporarily unavailable:') ||
    message.startsWith('DNS error:') ||
    message.startsWith('Connection reset:') ||
    message.startsWith('Connection timed out:') ||
    message.startsWith('Request timed out:') ||
    message.startsWith('Route unreachable:') ||
    message.startsWith('Connection refused:') ||
    message === 'Network error: unable to reach SiteSpecs API'
  ) {
    return 'upstream_unavailable';
  }

  return 'api_error';
}

export async function analyzeCommand(domain: string, options: AnalyzeOptions) {
  const effectiveOptions: AnalyzeOptions = { ...options };

  // Normalize domain
  const normalizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

  const profile = typeof effectiveOptions.profile === 'string' ? effectiveOptions.profile.trim().toLowerCase() : '';
  if (profile) {
    if (profile === 'ci') {
      const hasExplicitOutputMode = Boolean(
        effectiveOptions.summaryJson || effectiveOptions.summary || effectiveOptions.json
      );

      // CI defaults: deterministic one-line JSON output.
      if (!hasExplicitOutputMode) effectiveOptions.summaryJson = true;

      // If a baseline is provided, assume drift should fail CI unless user explicitly chose otherwise.
      if (effectiveOptions.diff && effectiveOptions.failOnDiff === undefined) effectiveOptions.failOnDiff = true;
    } else if (profile === 'report') {
      // Human-readable mode: more detail in formatted output.
      if (effectiveOptions.verbose === undefined) effectiveOptions.verbose = true;
    } else {
      // Treat as a usage error (consistent with other "exit 2" contract paths).
      if (effectiveOptions.summaryJson) {
        console.log(
          JSON.stringify({
            ok: false,
            domain: normalizedDomain,
            drift_changed: 0,
            drift_added: 0,
            drift_removed: 0,
            exit: 2,
            error: `invalid_profile: ${effectiveOptions.profile}`,
          })
        );
        process.exit(2);
      }

      if (effectiveOptions.summary) {
        console.log(`SUMMARY ${normalizedDomain} exit=2`);
        process.exit(2);
      }

      console.error(`Invalid --profile value: ${effectiveOptions.profile} (expected: ci|report)`);
      process.exit(2);
    }
  }

  if (effectiveOptions.summaryJson) {
    const baselinePath = effectiveOptions.diff;

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

    const topN = effectiveOptions.topChanges;
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

    if (effectiveOptions.failOnDiff && !baselinePath) {
      exitWith(baseOut({ ok: false, exit: 2, error: 'baseline_missing' }));
      return;
    }

    if (effectiveOptions.trend && !baselinePath) {
      exitWith(baseOut({ ok: false, exit: 2, error: 'baseline_missing' }));
      return;
    }

    let baselineJson: unknown | undefined;
    let trendBaseline: { drift_changed: number; drift_added: number; drift_removed: number } | undefined;
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

    if (effectiveOptions.trend) {
      let trendRaw: string;
      try {
        trendRaw = await readFile(effectiveOptions.trend, 'utf8');
      } catch {
        exitWith(baseOut({ ok: false, exit: 2, error: `trend_missing: ${effectiveOptions.trend}` }));
        return;
      }

      try {
        const parsed = JSON.parse(trendRaw) as Partial<{ drift_changed: number; drift_added: number; drift_removed: number }>;
        if (
          typeof parsed.drift_changed !== 'number' ||
          typeof parsed.drift_added !== 'number' ||
          typeof parsed.drift_removed !== 'number'
        ) {
          throw new Error('invalid_trend');
        }

        trendBaseline = {
          drift_changed: parsed.drift_changed,
          drift_added: parsed.drift_added,
          drift_removed: parsed.drift_removed,
        };
      } catch {
        exitWith(baseOut({ ok: false, exit: 2, error: `trend_parse_error: ${effectiveOptions.trend}` }));
        return;
      }
    }

    let data: unknown;
    try {
      data = await fetchAnalysis(normalizedDomain);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      exitWith(
        baseOut({
          ok: false,
          exit: 1,
          error: classifyFetchFailure(message),
        })
      );
      return;
    }

    if (effectiveOptions.save) {
      try {
        await saveAnalysisJson(effectiveOptions.save, data);
      } catch {
        exitWith(baseOut({ ok: false, exit: 2, error: `save_error: ${effectiveOptions.save}` }));
        return;
      }
    }

    if (baselinePath) {
      const { changed, added, removed } = computeJsonDriftCounts(baselineJson, data);
      const drift = changed + added + removed;
      const exit = effectiveOptions.failOnDiff && drift > 0 ? 1 : 0;

      const out: SummaryJsonOutput = {
        ok: exit === 0,
        domain: normalizedDomain,
        exit,
        drift_changed: changed,
        drift_added: added,
        drift_removed: removed,
        error: null,
      };

      if (trendBaseline) {
        out.trend_delta_changed = changed - trendBaseline.drift_changed;
        out.trend_delta_added = added - trendBaseline.drift_added;
        out.trend_delta_removed = removed - trendBaseline.drift_removed;
      }

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

  if (effectiveOptions.summary) {
    let baselineJson: unknown | undefined;
    let trendBaseline: { drift_changed: number; drift_added: number; drift_removed: number } | undefined;

    if (effectiveOptions.diff) {
      if (effectiveOptions.topChanges !== undefined) {
        const n = effectiveOptions.topChanges;
        if (!Number.isInteger(n) || n <= 0) {
          console.log(`SUMMARY ${normalizedDomain} exit=2`);
          process.exit(2);
        }
      }

      try {
        const raw = await readFile(effectiveOptions.diff, 'utf8');
        baselineJson = JSON.parse(raw);
      } catch {
        console.log(`SUMMARY ${normalizedDomain} exit=2`);
        process.exit(2);
      }
    }

    if (effectiveOptions.trend && !effectiveOptions.diff) {
      console.log(`SUMMARY ${normalizedDomain} exit=2`);
      process.exit(2);
    }

    if (effectiveOptions.trend) {
      try {
        const trendRaw = await readFile(effectiveOptions.trend, 'utf8');
        const parsed = JSON.parse(trendRaw) as Partial<{ drift_changed: number; drift_added: number; drift_removed: number }>;
        if (
          typeof parsed.drift_changed !== 'number' ||
          typeof parsed.drift_added !== 'number' ||
          typeof parsed.drift_removed !== 'number'
        ) {
          throw new Error('invalid_trend');
        }

        trendBaseline = {
          drift_changed: parsed.drift_changed,
          drift_added: parsed.drift_added,
          drift_removed: parsed.drift_removed,
        };
      } catch {
        console.log(`SUMMARY ${normalizedDomain} exit=2`);
        process.exit(2);
      }
    }

    try {
      const data = await fetchAnalysis(normalizedDomain);

      if (effectiveOptions.save) {
        try {
          await saveAnalysisJson(effectiveOptions.save, data);
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

      if (effectiveOptions.diff) {
        const { changed, added, removed } = computeJsonDriftCounts(baselineJson, data);
        const drift = changed + added + removed;
        const exit = effectiveOptions.failOnDiff && drift > 0 ? 1 : 0;

        let extra = '';
        if (trendBaseline) {
          extra += ` trend_delta_changed=${changed - trendBaseline.drift_changed} trend_delta_added=${added - trendBaseline.drift_added} trend_delta_removed=${removed - trendBaseline.drift_removed}`;
        }
        if (effectiveOptions.topChanges !== undefined) {
          const n = effectiveOptions.topChanges;
          const details = computeJsonDriftDetails(baselineJson, data);
          const topChanged = details.changedPaths.slice(0, n).join(',');
          const topAdded = details.addedPaths.slice(0, n).join(',');
          const topRemoved = details.removedPaths.slice(0, n).join(',');
          extra += ` top_changed=${topChanged} top_added=${topAdded} top_removed=${topRemoved}`;
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

    if (effectiveOptions.save) {
      try {
        await saveAnalysisJson(effectiveOptions.save, data);
      } catch (error) {
        spinner.fail(chalk.red('Analysis failed'));
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          chalk.red(`\n✗ Failed to save analysis JSON to ${effectiveOptions.save}: ${message}`)
        );
        process.exit(1);
      }
    }
    
    spinner.succeed(chalk.green(`Analysis complete for ${chalk.bold(data.domain)}`));
    
    // Output as JSON if requested
    if (effectiveOptions.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    
    // Format and display output
    formatOutput(data, effectiveOptions);
    
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
