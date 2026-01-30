import ora from 'ora';
import chalk from 'chalk';
import { fetchAnalysis, type AnalysisResponse } from '../lib/api';
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
  // Normalize domain
  const normalizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
  
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
