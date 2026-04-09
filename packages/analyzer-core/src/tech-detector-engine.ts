/**
 * Native Technology Detection Engine
 * Pattern-based detection without external dependencies
 */

import { getPrimaryFrameworkName } from './framework-selection.js';
import { TECH_RULES, TechRule, TechCategory } from './tech-rules.js';

export interface DetectionMatch {
  rule: TechRule;
  matches: {
    type: 'html' | 'header' | 'script' | 'meta' | 'cookie' | 'dom' | 'global';
    pattern: string;
    value?: string;
  }[];
  score: number;
  version?: string;
}

export interface TechDetection {
  name: string;
  category: TechCategory;
  confidence: 'high' | 'medium' | 'low';
  version?: string;
  website?: string;
  description?: string;
  icon?: string;
}

export interface DetectionInput {
  url: string;
  html: string;
  headers: Record<string, string>;
  cookies?: string[];
}

type MatchType = DetectionMatch["matches"][number]["type"];

const MATCH_EVIDENCE_WEIGHTS: Record<MatchType, number> = {
  html: 1,
  script: 2,
  dom: 2,
  header: 3,
  meta: 3,
  cookie: 3,
  global: 3,
};

/**
 * Main technology detection engine
 */
export class TechDetectorEngine {
  private rules: TechRule[];

  constructor(rules: TechRule[] = TECH_RULES) {
    this.rules = rules;
  }

  /**
   * Detect all technologies from input data
   */
  async detect(input: DetectionInput): Promise<TechDetection[]> {
    const matches: DetectionMatch[] = [];
    const scriptSources = this.extractScriptSources(input.html);

    // Test each rule
    for (const rule of this.rules) {
      const match = this.testRule(rule, input, scriptSources);
      if (match && match.score > 0) {
        matches.push(match);
      }
    }

    // Convert matches to detections with confidence scores
    return matches.map(match => this.matchToDetection(match));
  }

  /**
   * Test a single rule against input data
   */
  private testRule(rule: TechRule, input: DetectionInput, scriptSources: string[]): DetectionMatch | null {
    const matches: DetectionMatch['matches'] = [];
    let version: string | undefined;

    // Test HTML patterns
    if (rule.patterns.html) {
      for (const pattern of rule.patterns.html) {
        if (pattern.test(input.html)) {
          matches.push({
            type: 'html',
            pattern: pattern.source,
          });

          // Try to extract version
          if (rule.version && !version) {
            const versionMatch = input.html.match(rule.version.pattern);
            if (versionMatch && versionMatch[rule.version.group]) {
              version = versionMatch[rule.version.group];
            }
          }
        }
      }
    }

    // Test HTTP headers
    if (rule.patterns.headers) {
      for (const [headerName, pattern] of Object.entries(rule.patterns.headers)) {
        const headerValue = this.getHeaderValue(input.headers, headerName);
        if (headerValue && pattern.test(headerValue)) {
          matches.push({
            type: 'header',
            pattern: `${headerName}: ${pattern.source}`,
            value: headerValue,
          });

          // Try to extract version from header
          if (rule.version && !version) {
            const versionMatch = headerValue.match(rule.version.pattern);
            if (versionMatch && versionMatch[rule.version.group]) {
              version = versionMatch[rule.version.group];
            }
          }
        }
      }
    }

    // Test script sources
    if (rule.patterns.scripts) {
      for (const scriptPattern of rule.patterns.scripts) {
        const scriptRegex = this.buildScriptRegex(scriptPattern);
        const matchedSource = scriptSources.find((source) => scriptRegex.test(source));
        if (matchedSource) {
          matches.push({
            type: 'script',
            pattern: scriptPattern,
            value: matchedSource,
          });
        }
      }
    }

    // Test meta tags
    if (rule.patterns.meta) {
      for (const [metaName, pattern] of Object.entries(rule.patterns.meta)) {
        const metaRegex = new RegExp(
          `<meta[^>]+name=["']${metaName}["'][^>]+content=["']([^"']+)["']`,
          'i'
        );
        const metaMatch = input.html.match(metaRegex);
        if (metaMatch && pattern.test(metaMatch[1])) {
          matches.push({
            type: 'meta',
            pattern: `meta[${metaName}]: ${pattern.source}`,
            value: metaMatch[1],
          });

          // Try to extract version from meta
          if (rule.version && !version) {
            const versionMatch = metaMatch[1].match(rule.version.pattern);
            if (versionMatch && versionMatch[rule.version.group]) {
              version = versionMatch[rule.version.group];
            }
          }
        }
      }
    }

    // Test cookies
    if (rule.patterns.cookies && input.cookies) {
      for (const cookiePattern of rule.patterns.cookies) {
        const cookieRegex = new RegExp(this.escapeRegex(cookiePattern), 'i');
        if (input.cookies.some(cookie => cookieRegex.test(cookie))) {
          matches.push({
            type: 'cookie',
            pattern: cookiePattern,
          });
        }
      }
    }

    // Test DOM selectors (check if selector exists in HTML)
    if (rule.patterns.dom) {
      for (const selector of rule.patterns.dom) {
        // Simple check for attribute existence in HTML
        const attrRegex = new RegExp(selector.replace('*=', '=').replace(/[[\]]/g, ''), 'i');
        if (attrRegex.test(input.html)) {
          matches.push({
            type: 'dom',
            pattern: selector,
          });
        }
      }
    }

    // Test JavaScript globals (check for window.X or var X in scripts)
    if (rule.patterns.globals) {
      for (const globalVar of rule.patterns.globals) {
        const globalRegex = new RegExp(
          `(window\\.${globalVar}|var\\s+${globalVar}|const\\s+${globalVar}|let\\s+${globalVar})`,
          'i'
        );
        if (globalRegex.test(input.html)) {
          matches.push({
            type: 'global',
            pattern: globalVar,
          });
        }
      }
    }

    // Calculate score
    if (matches.length === 0) {
      return null;
    }

    const baseWeight = rule.weight || 1;
    const score = this.calculateEvidenceScore(matches) * baseWeight;

    return {
      rule,
      matches,
      score,
      version,
    };
  }

  /**
   * Convert detection match to final detection result
   */
  private matchToDetection(match: DetectionMatch): TechDetection {
    const { rule, version } = match;

    // Calculate confidence based on score and number of matches
    const confidence = this.calculateConfidence(match.matches);

    return {
      name: rule.name,
      category: rule.category,
      confidence,
      version,
      website: rule.website,
      description: rule.description,
      icon: rule.icon,
    };
  }

  /**
   * Get header value (case-insensitive)
   */
  private getHeaderValue(headers: Record<string, string>, name: string): string | undefined {
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Escape special regex characters for literal matching
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private extractScriptSources(html: string): string[] {
    const sources = new Set<string>();
    const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const modulePreloadRegex =
      /<link[^>]+rel=["'][^"']*\bmodulepreload\b[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi;

    let match: RegExpExecArray | null;
    while ((match = scriptRegex.exec(html)) !== null) {
      const src = match[1]?.trim();
      if (src) {
        sources.add(src);
      }
    }

    while ((match = modulePreloadRegex.exec(html)) !== null) {
      const href = match[1]?.trim();
      if (href) {
        sources.add(href);
      }
    }

    return Array.from(sources);
  }

  private buildScriptRegex(pattern: string): RegExp {
    const escaped = this.escapeRegex(pattern);

    if (/^[a-z0-9-]+$/i.test(pattern)) {
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    }

    return new RegExp(escaped, 'i');
  }

  private calculateEvidenceScore(matches: DetectionMatch["matches"]): number {
    return matches.reduce((total, match) => total + MATCH_EVIDENCE_WEIGHTS[match.type], 0);
  }

  private calculateConfidence(matches: DetectionMatch["matches"]): 'high' | 'medium' | 'low' {
    const evidenceScore = this.calculateEvidenceScore(matches);
    const strongSignals = matches.filter((match) =>
      match.type === 'header' ||
      match.type === 'meta' ||
      match.type === 'cookie' ||
      match.type === 'global'
    ).length;
    const mediumSignals = matches.filter((match) => match.type === 'script' || match.type === 'dom').length;
    const weakSignals = matches.filter((match) => match.type === 'html').length;

    if ((strongSignals >= 1 && evidenceScore >= 6) || (mediumSignals >= 2 && evidenceScore >= 6)) {
      return 'high';
    }

    if (
      (strongSignals >= 1 && evidenceScore >= 3) ||
      (mediumSignals >= 1 && evidenceScore >= 3) ||
      weakSignals >= 2
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Filter detections by minimum confidence
   */
  filterByConfidence(
    detections: TechDetection[],
    minConfidence: 'low' | 'medium' | 'high' = 'low'
  ): TechDetection[] {
    const confidenceLevels = { low: 1, medium: 2, high: 3 };
    const minLevel = confidenceLevels[minConfidence];

    return detections.filter(d => confidenceLevels[d.confidence] >= minLevel);
  }

  /**
   * Group detections by category
   */
  groupByCategory(detections: TechDetection[]): Map<TechCategory, TechDetection[]> {
    const grouped = new Map<TechCategory, TechDetection[]>();

    for (const detection of detections) {
      const existing = grouped.get(detection.category) || [];
      existing.push(detection);
      grouped.set(detection.category, existing);
    }

    return grouped;
  }

  /**
   * Get the primary technology for a category (highest confidence)
   */
  getPrimaryTech(detections: TechDetection[], category: TechCategory): TechDetection | undefined {
    const categoryDetections = detections.filter(d => d.category === category);
    
    if (categoryDetections.length === 0) {
      return undefined;
    }

    // Sort by confidence (high > medium > low)
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    categoryDetections.sort((a, b) => confidenceOrder[b.confidence] - confidenceOrder[a.confidence]);

    return categoryDetections[0];
  }

  /**
   * Get hosting provider (PaaS, Hosting, or CDN)
   */
  getHostingProvider(detections: TechDetection[]): string | undefined {
    const hostingCategories = [TechCategory.PAAS, TechCategory.HOSTING, TechCategory.CDN];
    
    for (const category of hostingCategories) {
      const provider = this.getPrimaryTech(detections, category);
      if (provider && provider.confidence === 'high') {
        return provider.name;
      }
    }

    return undefined;
  }

  /**
   * Get primary framework
   */
  getFramework(detections: TechDetection[]): string | undefined {
    return getPrimaryFrameworkName(detections);
  }

  /**
   * Get CMS platform
   */
  getCMS(detections: TechDetection[]): string | undefined {
    const cms = this.getPrimaryTech(detections, TechCategory.CMS);
    return cms?.name;
  }

  /**
   * Deduplicate detections (remove duplicates, keep highest confidence)
   */
  deduplicate(detections: TechDetection[]): TechDetection[] {
    const seen = new Map<string, TechDetection>();

    for (const detection of detections) {
      const existing = seen.get(detection.name);
      
      if (!existing) {
        seen.set(detection.name, detection);
        continue;
      }

      // Keep the one with higher confidence
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      if (confidenceOrder[detection.confidence] > confidenceOrder[existing.confidence]) {
        seen.set(detection.name, detection);
      }
    }

    return Array.from(seen.values());
  }
}

/**
 * Convenience function for quick detection
 */
export async function detectTechnologies(input: DetectionInput): Promise<TechDetection[]> {
  const engine = new TechDetectorEngine();
  const detections = await engine.detect(input);
  return engine.deduplicate(detections);
}
