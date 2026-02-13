import ora from 'ora';
import chalk from 'chalk';
import { readFile } from 'node:fs/promises';
import { fetchAnalysis, type AnalysisResponse } from '../lib/api';
import { computeJsonDriftCounts } from '../lib/json-diff';
import { formatOutput } from '../lib/formatter';

interface AnalyzeOptions {
  verbose?: boolean;
  json?: boolean;
  summary?: boolean;
  diff?: string;
  failOnDiff?: boolean;
  tech?: boolean;
  seo?: boolean;
  performance?: boolean;
  hosting?: boolean;
}

export async function analyzeCommand(domain: string, options: AnalyzeOptions) {
  // Normalize domain
  const normalizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

  if (options.summary) {
    let baselineJson: unknown | undefined;

    if (options.diff) {
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

      const status = data.status;
      const tech = Array.isArray(data.technologies) ? data.technologies.length : 0;
      const seo = (data as AnalysisResponse).seo?.score ?? 'na';
      const hosting = (data as AnalysisResponse).host ?? 'na';
      const perf = 'na';

      if (options.diff) {
        const { changed, added, removed } = computeJsonDriftCounts(baselineJson, data);
        const drift = changed + added + removed;
        const exit = options.failOnDiff && drift > 0 ? 1 : 0;

        console.log(
          `SUMMARY ${data.domain} status=${status} tech=${tech} seo=${seo} perf=${perf} hosting=${hosting} drift_changed=${changed} drift_added=${added} drift_removed=${removed} exit=${exit}`
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
