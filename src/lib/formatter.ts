import chalk from 'chalk';
import { WebsiteAnalysis } from './api';

interface FormatOptions {
  verbose?: boolean;
  tech?: boolean;
  seo?: boolean;
  performance?: boolean;
  hosting?: boolean;
}

export function formatOutput(analysis: WebsiteAnalysis, options: FormatOptions): string {
  const lines: string[] = [];
  
  // Header
  lines.push('');
  lines.push(chalk.bold.cyan(`🌐 ${analysis.domain}`));
  lines.push(chalk.gray('━'.repeat(60)));
  lines.push('');

  // Show all sections by default, or only requested sections
  const showAll = !options.tech && !options.seo && !options.performance && !options.hosting;

  // Technology Stack
  if (showAll || options.tech) {
    lines.push(chalk.bold('📦 Technology Stack'));
    
    const techByCategory = analysis.technologies.reduce((acc, tech) => {
      if (!acc[tech.category]) acc[tech.category] = [];
      acc[tech.category].push(tech);
      return acc;
    }, {} as Record<string, typeof analysis.technologies>);

    Object.entries(techByCategory).forEach(([category, techs]) => {
      const techList = techs.map(t => 
        t.version ? `${t.name} ${chalk.gray(t.version)}` : t.name
      ).join(', ');
      lines.push(`  ${chalk.gray(category + ':')} ${techList}`);
    });
    
    lines.push('');
  }

  // Performance
  if (showAll || options.performance) {
    lines.push(chalk.bold('⚡ Performance'));
    lines.push(`  ${chalk.gray('Load Time:')}    ${formatTime(analysis.performance.loadTime)}`);
    lines.push(`  ${chalk.gray('Page Size:')}    ${formatBytes(analysis.performance.pageSize)}`);
    lines.push(`  ${chalk.gray('Requests:')}     ${analysis.performance.requestCount}`);
    
    if (analysis.performance.lcp) {
      const lcpStatus = analysis.performance.lcp < 2.5 ? chalk.green('Good') : 
                       analysis.performance.lcp < 4 ? chalk.yellow('Needs Improvement') : 
                       chalk.red('Poor');
      lines.push(`  ${chalk.gray('LCP:')}          ${formatTime(analysis.performance.lcp * 1000)} ${lcpStatus}`);
    }
    
    lines.push('');
  }

  // SEO
  if (showAll || options.seo) {
    lines.push(chalk.bold('🔍 SEO'));
    lines.push(`  ${chalk.gray('Title:')}        ${analysis.seo.title || chalk.red('Missing')}`);
    lines.push(`  ${chalk.gray('Description:')}  ${analysis.seo.description ? chalk.green('✓ Present') : chalk.red('✗ Missing')}`);
    lines.push(`  ${chalk.gray('Open Graph:')}   ${analysis.seo.openGraph ? chalk.green('✓ Complete') : chalk.yellow('✗ Incomplete')}`);
    lines.push(`  ${chalk.gray('SSL:')}          ${formatSSL(analysis.hosting.ssl)}`);
    lines.push('');
  }

  // Hosting
  if (showAll || options.hosting) {
    lines.push(chalk.bold('🌍 Hosting'));
    if (analysis.hosting.server) {
      lines.push(`  ${chalk.gray('Server:')}       ${analysis.hosting.server}`);
    }
    if (analysis.hosting.ip) {
      lines.push(`  ${chalk.gray('IP:')}           ${analysis.hosting.ip}`);
    }
    if (analysis.hosting.location) {
      lines.push(`  ${chalk.gray('Location:')}     ${analysis.hosting.location}`);
    }
    if (analysis.hosting.cdn) {
      lines.push(`  ${chalk.gray('CDN:')}          ${analysis.hosting.cdn}`);
    }
    if (analysis.domain_info.registeredAt) {
      const age = analysis.domain_info.age || 'Unknown';
      lines.push(`  ${chalk.gray('Online Since:')} ${analysis.domain_info.registeredAt} ${chalk.gray(`(${age})`)}`);
    }
    lines.push('');
  }

  lines.push(chalk.gray('━'.repeat(60)));
  lines.push('');

  return lines.join('\n');
}

function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  } else {
    return `${(ms / 1000).toFixed(1)}s`;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

function formatSSL(ssl: { valid: boolean; daysUntilExpiry?: number }): string {
  if (!ssl.valid) {
    return chalk.red('✗ Invalid');
  }
  
  if (ssl.daysUntilExpiry !== undefined) {
    const days = ssl.daysUntilExpiry;
    const color = days > 30 ? chalk.green : days > 7 ? chalk.yellow : chalk.red;
    return color(`✓ Valid (expires in ${days} days)`);
  }
  
  return chalk.green('✓ Valid');
}
