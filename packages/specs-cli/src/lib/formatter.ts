import chalk from 'chalk';
import { formatBytes, formatRelativeTime, type AnalysisResponse } from './api.js';
import { getRedirectDisplayNote } from './redirects.js';

interface FormatOptions {
  verbose?: boolean;
  tech?: boolean;
  seo?: boolean;
  performance?: boolean;
  hosting?: boolean;
}

export function formatOutput(data: AnalysisResponse, options: FormatOptions) {
  console.log();
  
  // If specific sections requested, only show those
  const showAll = !options.tech && !options.seo && !options.performance && !options.hosting;
  
  // Header
  console.log(chalk.bold.white('═'.repeat(60)));
  console.log(chalk.bold.cyan(`  ${data.domain}`));
  console.log(chalk.gray(`  ${data.url}`));
  console.log(chalk.bold.white('═'.repeat(60)));
  console.log();
  
  // Status
  if (showAll) {
    const statusColor = data.status === 'online' ? chalk.green : 
                       data.status === 'offline' ? chalk.red : 
                       chalk.yellow;
    console.log(chalk.bold('Status:'), statusColor(data.status.toUpperCase()));

    if (data.execution) {
      const executionLabel =
        data.execution.engine === 'agent-browser+http'
          ? 'agent-browser + http'
          : data.execution.engine;
      console.log(
        chalk.gray(
          `Execution: ${data.execution.mode} via ${executionLabel}${data.execution.degraded ? ' (degraded)' : ''}`
        )
      );
    }
    
    if (data.lastAnalyzed) {
      console.log(chalk.gray(`Last analyzed: ${formatRelativeTime(data.lastAnalyzed)}`));
    }

    const redirectNote = getRedirectDisplayNote(data);
    if (redirectNote) {
      console.log(chalk.yellow(redirectNote));
    }

    if (data.execution?.fallbackReason) {
      console.log(chalk.yellow(`Fallback: ${data.execution.fallbackReason}`));
    }

    if (data.execution?.enrichmentStatus === 'complete') {
      console.log(chalk.gray('SiteSpecs enrichment: complete'));
    } else if (data.execution?.enrichmentStatus === 'pending') {
      console.log(chalk.yellow('SiteSpecs enrichment: pending'));
    } else if (data.execution?.enrichmentStatus === 'failed') {
      console.log(chalk.yellow('SiteSpecs enrichment: unavailable'));
    }
    console.log();
  }
  
  // Technology Stack
  if (showAll || options.tech) {
    console.log(chalk.bold.blue('🔧 Technology Stack'));
    console.log(chalk.gray('─'.repeat(60)));
    
    if (data.framework) {
      console.log(`  ${chalk.bold('Framework:')}    ${chalk.cyan(data.framework)}`);
    }
    
    if (data.host) {
      console.log(`  ${chalk.bold('Hosting:')}      ${chalk.cyan(data.host)}`);
    }
    
    if (data.technologies && data.technologies.length > 0) {
      console.log();
      console.log(chalk.gray('  All detected technologies:'));

      const sortedTechnologies = [...data.technologies].sort((left, right) => {
        if (left.category !== right.category) {
          return left.category.localeCompare(right.category);
        }

        const confidenceOrder: Record<"high" | "medium" | "low", number> = {
          high: 0,
          medium: 1,
          low: 2,
        };
        if (left.confidence !== right.confidence) {
          const leftConfidence =
            left.confidence === "high" || left.confidence === "medium" ? left.confidence : "low";
          const rightConfidence =
            right.confidence === "high" || right.confidence === "medium" ? right.confidence : "low";
          return confidenceOrder[leftConfidence] - confidenceOrder[rightConfidence];
        }

        return left.name.localeCompare(right.name);
      });
      
      // Group by category
      const grouped = sortedTechnologies.reduce((acc, tech) => {
        if (!acc[tech.category]) {
          acc[tech.category] = [];
        }
        acc[tech.category].push(tech);
        return acc;
      }, {} as Record<string, typeof data.technologies>);
      
      Object.entries(grouped).forEach(([category, techs]) => {
        console.log();
        console.log(chalk.gray(`  ${category}:`));
        techs.forEach(tech => {
          const version = tech.version ? chalk.gray(` v${tech.version}`) : '';
          const confidence = tech.confidence === 'high' ? chalk.green('●') : 
                           tech.confidence === 'medium' ? chalk.yellow('●') : 
                           chalk.gray('●');
          console.log(`    ${confidence} ${chalk.white(tech.name)}${version}`);
        });
      });
    } else {
      console.log(chalk.gray('  No technologies detected yet'));
    }
    console.log();
  }
  
  // SEO Information
  if ((showAll || options.seo) && data.seo) {
    console.log(chalk.bold.green('📊 SEO Metrics'));
    console.log(chalk.gray('─'.repeat(60)));
    
    if (data.seo.score !== null && data.seo.score !== undefined) {
      const scoreColor = data.seo.score >= 80 ? chalk.green :
                        data.seo.score >= 60 ? chalk.blue :
                        data.seo.score >= 40 ? chalk.yellow :
                        chalk.red;
      console.log(`  ${chalk.bold('SEO Score:')}    ${scoreColor(data.seo.score + '/100')}`);
    }
    
    if (data.seo.hasSSL !== undefined) {
      const sslIcon = data.seo.hasSSL ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${chalk.bold('SSL/HTTPS:')}    ${sslIcon} ${data.seo.hasSSL ? 'Enabled' : 'Disabled'}`);
    }
    
    if (data.seo.mobileOptimized !== undefined) {
      const mobileIcon = data.seo.mobileOptimized ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${chalk.bold('Mobile:')}       ${mobileIcon} ${data.seo.mobileOptimized ? 'Optimized' : 'Not optimized'}`);
    }
    
    if (data.seo.wordCount) {
      console.log(`  ${chalk.bold('Word Count:')}   ${chalk.white(data.seo.wordCount.toLocaleString())}`);
    }
    
    if (options.verbose && data.seo.title) {
      console.log();
      console.log(chalk.gray('  Title:'));
      console.log(`    ${chalk.white(data.seo.title)}`);
    }
    
    if (options.verbose && data.seo.description) {
      console.log();
      console.log(chalk.gray('  Description:'));
      console.log(`    ${chalk.white(data.seo.description)}`);
    }

    if (options.verbose && data.seo.canonicalUrl) {
      console.log();
      console.log(chalk.gray('  Canonical:'));
      console.log(`    ${chalk.white(data.seo.canonicalUrl)}`);
    }

    if (options.verbose && data.seo.robots) {
      console.log(`  ${chalk.bold('Robots:')}       ${chalk.white(data.seo.robots)}`);
    }

    if (options.verbose && data.seo.sitemapUrls && data.seo.sitemapUrls.length > 0) {
      console.log();
      console.log(chalk.gray('  Sitemaps:'));
      data.seo.sitemapUrls.forEach((sitemapUrl) => {
        console.log(`    ${chalk.white(sitemapUrl)}`);
      });
    }
    
    console.log();
  }
  
  // Performance Metrics
  if ((showAll || options.performance) && data.performance) {
    console.log(chalk.bold.magenta('⚡ Performance'));
    console.log(chalk.gray('─'.repeat(60)));
    
    if (data.performance.responseTime) {
      const timeColor = data.performance.responseTime < 200 ? chalk.green :
                       data.performance.responseTime < 500 ? chalk.yellow :
                       chalk.red;
      console.log(`  ${chalk.bold('Response Time:')} ${timeColor(data.performance.responseTime + 'ms')}`);
    }
    
    if (data.performance.pageSize) {
      console.log(`  ${chalk.bold('Page Size:')}     ${chalk.white(formatBytes(data.performance.pageSize))}`);
    }
    
    if (data.performance.statusCode) {
      const statusColor = data.performance.statusCode === 200 ? chalk.green : chalk.red;
      console.log(`  ${chalk.bold('Status Code:')}   ${statusColor(data.performance.statusCode)}`);
    }

    if (data.performance.domContentLoadedMs) {
      console.log(`  ${chalk.bold('DOMContentLoaded:')} ${chalk.white(`${data.performance.domContentLoadedMs}ms`)}`);
    }

    if (data.performance.loadEventMs) {
      console.log(`  ${chalk.bold('Load Event:')}    ${chalk.white(`${data.performance.loadEventMs}ms`)}`);
    }
    
    console.log();
  }
  
  // Hosting Information
  if ((showAll || options.hosting) && (data.host || data.dns || data.tls)) {
    console.log(chalk.bold.yellow('🌐 Hosting'));
    console.log(chalk.gray('─'.repeat(60)));

    if (data.host) {
      console.log(`  ${chalk.bold('Provider:')}      ${chalk.white(data.host)}`);
    }

    if (data.dns?.cname && data.dns.cname.length > 0) {
      console.log(`  ${chalk.bold('CNAME:')}         ${chalk.white(data.dns.cname.join(', '))}`);
    }

    if (data.dns?.addresses && data.dns.addresses.length > 0 && options.verbose) {
      console.log(`  ${chalk.bold('Addresses:')}     ${chalk.white(data.dns.addresses.join(', '))}`);
    }

    if (data.tls?.protocol) {
      console.log(`  ${chalk.bold('TLS:')}           ${chalk.white(data.tls.protocol)}`);
    }

    if (data.tls?.issuer && options.verbose) {
      console.log(`  ${chalk.bold('Issuer:')}        ${chalk.white(data.tls.issuer)}`);
    }

    if (data.tls?.validTo) {
      const daysRemaining = data.tls.daysRemaining !== undefined ? ` (${data.tls.daysRemaining} days left)` : '';
      console.log(`  ${chalk.bold('Certificate:')}   ${chalk.white(`${data.tls.validTo}${daysRemaining}`)}`);
    }
    
    if (data.onlineSince) {
      console.log(`  ${chalk.bold('Online Since:')}  ${chalk.white(formatRelativeTime(data.onlineSince))}`);
    }
    
    console.log();
  }
}
