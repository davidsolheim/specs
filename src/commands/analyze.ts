import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { getWebsiteAnalysis } from '../lib/api';
import { formatOutput } from '../lib/formatter';

interface AnalyzeOptions {
  verbose?: boolean;
  json?: boolean;
  tech?: boolean;
  seo?: boolean;
  performance?: boolean;
  hosting?: boolean;
}

export async function analyzeCommand(domain: string, options: AnalyzeOptions) {
  // Normalize domain (remove protocol, www, trailing slash)
  const normalizedDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');

  const spinner = ora(`Analyzing ${chalk.cyan(normalizedDomain)}...`).start();

  try {
    // Fetch analysis data from sitespecs.com API
    const analysis = await getWebsiteAnalysis(normalizedDomain);

    spinner.succeed(chalk.green(`Analysis complete for ${chalk.cyan(normalizedDomain)}`));
    console.log('');

    // Output as JSON if requested
    if (options.json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }

    // Format and display output
    const output = formatOutput(analysis, options);
    console.log(output);

  } catch (error) {
    spinner.fail(chalk.red('Analysis failed'));
    
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    } else {
      console.error(chalk.red('An unknown error occurred'));
    }
    
    process.exit(1);
  }
}
