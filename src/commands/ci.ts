import { analyzeCommand } from './analyze';

export async function ciCommand(domain: string, options: { baseline?: string }) {
  if (!domain || !options.baseline) {
    console.error('CI_BASELINE_REQUIRED');
    process.exit(2);
    return;
  }

  return analyzeCommand(domain, {
    profile: 'ci',
    summaryJson: true,
    diff: options.baseline,
    failOnDiff: true,
  });
}

