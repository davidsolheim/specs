/**
 * Unknown Technology Pattern Extractor
 * Intelligently captures unrecognized technology patterns for future rule creation
 */

import { TECH_RULES } from './tech-rules.js';

export interface UnknownPattern {
  detectionType: 'meta' | 'script' | 'header' | 'dom' | 'global' | 'pattern';
  rawValue: string;
  context: string;
  suggestedName?: string;
  suggestedVersion?: string;
  suggestedCategory?: string;
}

/**
 * Known CDN domains (patterns we already detect)
 */
const KNOWN_CDN_PATTERNS = [
  'cdn.shopify.com',
  'static.wixstatic.com',
  'cdn.segment.com',
  'js.stripe.com',
  'paypal.com',
  'google-analytics.com',
  'googletagmanager.com',
  'fonts.googleapis.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'code.jquery.com',
  'maxcdn.bootstrapcdn.com',
];

/**
 * Extract unknown technology patterns from crawl data
 */
export function extractUnknownPatterns(
  html: string,
  headers: Record<string, string>,
  url: string
): UnknownPattern[] {
  const patterns: UnknownPattern[] = [];

  // 1. Extract meta generator tags
  patterns.push(...extractMetaGenerators(html));

  // 2. Extract uncommon script sources
  patterns.push(...extractUncommonScripts(html));

  // 3. Extract custom HTTP headers
  patterns.push(...extractCustomHeaders(headers));

  // 4. Extract framework-specific DOM attributes
  patterns.push(...extractFrameworkAttributes(html));

  // 5. Extract JavaScript globals
  patterns.push(...extractJavaScriptGlobals(html));

  // Filter out patterns that match known rules
  return patterns.filter(pattern => !isKnownPattern(pattern));
}

/**
 * Extract meta generator tags
 */
function extractMetaGenerators(html: string): UnknownPattern[] {
  const patterns: UnknownPattern[] = [];
  
  // Match meta generator tags
  const generatorRegex = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/gi;
  let match;
  
  while ((match = generatorRegex.exec(html)) !== null) {
    const rawValue = match[1];
    const parsed = parseNameVersion(rawValue);
    
    patterns.push({
      detectionType: 'meta',
      rawValue,
      context: 'meta[name=generator]',
      suggestedName: parsed.name,
      suggestedVersion: parsed.version,
      suggestedCategory: 'CMS',
    });
  }
  
  // Also check for framework meta tags
  const frameworkRegex = /<meta[^>]+name=["'](framework|platform|powered-by)["'][^>]+content=["']([^"']+)["']/gi;
  
  while ((match = frameworkRegex.exec(html)) !== null) {
    const rawValue = match[2];
    const parsed = parseNameVersion(rawValue);
    
    patterns.push({
      detectionType: 'meta',
      rawValue,
      context: `meta[name=${match[1]}]`,
      suggestedName: parsed.name,
      suggestedVersion: parsed.version,
      suggestedCategory: 'JavaScript Framework',
    });
  }
  
  return patterns;
}

/**
 * Extract uncommon script sources (not in known CDN list)
 */
function extractUncommonScripts(html: string): UnknownPattern[] {
  const patterns: UnknownPattern[] = [];
  
  // Match script src attributes
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let match;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1];
    
    // Skip common CDNs and relative paths
    if (src.startsWith('/') || src.startsWith('./')) continue;
    if (KNOWN_CDN_PATTERNS.some(cdn => src.includes(cdn))) continue;
    
    // Extract domain and suggest name
    try {
      const urlObj = new URL(src);
      const domain = urlObj.hostname;
      
      // Skip very common domains
      if (domain.includes('google.com') || domain.includes('facebook.com')) continue;
      
      const suggestedName = extractNameFromDomain(domain);
      
      patterns.push({
        detectionType: 'script',
        rawValue: src,
        context: 'script[src]',
        suggestedName,
        suggestedCategory: guessCategory(domain, src),
      });
    } catch {
      // Invalid URL, skip
    }
  }
  
  return patterns;
}

/**
 * Extract custom HTTP headers
 */
function extractCustomHeaders(headers: Record<string, string>): UnknownPattern[] {
  const patterns: UnknownPattern[] = [];
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    // Check for X-* headers (custom headers)
    if (lowerKey.startsWith('x-') && !isKnownHeader(lowerKey)) {
      const parsed = parseNameVersion(value);
      
      patterns.push({
        detectionType: 'header',
        rawValue: value,
        context: key,
        suggestedName: parsed.name || extractNameFromHeader(key),
        suggestedVersion: parsed.version,
        suggestedCategory: guessHeaderCategory(key),
      });
    }
    
    // Check for Server header with unknown values
    if (lowerKey === 'server' && !isKnownServer(value)) {
      const parsed = parseNameVersion(value);
      
      patterns.push({
        detectionType: 'header',
        rawValue: value,
        context: 'Server',
        suggestedName: parsed.name,
        suggestedVersion: parsed.version,
        suggestedCategory: 'Web Server',
      });
    }
    
    // Check for X-Powered-By with unknown values
    if (lowerKey === 'x-powered-by' && !isKnownPoweredBy(value)) {
      const parsed = parseNameVersion(value);
      
      patterns.push({
        detectionType: 'header',
        rawValue: value,
        context: 'X-Powered-By',
        suggestedName: parsed.name,
        suggestedVersion: parsed.version,
        suggestedCategory: 'Web Framework',
      });
    }
  }
  
  return patterns;
}

/**
 * Extract framework-specific DOM attributes
 */
function extractFrameworkAttributes(html: string): UnknownPattern[] {
  const patterns: UnknownPattern[] = [];
  
  // Look for data-* attributes that might indicate a framework
  const dataAttrRegex = /\s(data-[a-z0-9-]+(?:-app|-framework|-version))=["']([^"']+)["']/gi;
  let match;
  
  while ((match = dataAttrRegex.exec(html)) !== null) {
    const attr = match[1];
    const value = match[2];
    
    // Skip common attributes
    if (attr === 'data-reactroot' || attr === 'data-reactid') continue;
    
    const suggestedName = extractNameFromAttribute(attr);
    
    patterns.push({
      detectionType: 'dom',
      rawValue: value,
      context: attr,
      suggestedName,
      suggestedCategory: 'JavaScript Framework',
    });
  }
  
  return patterns;
}

/**
 * Extract JavaScript globals from inline scripts
 */
function extractJavaScriptGlobals(html: string): UnknownPattern[] {
  const patterns: UnknownPattern[] = [];
  
  // Look for window.X = or var X = patterns in inline scripts
  const globalRegex = /(?:window\.([A-Z][a-zA-Z0-9_]+)|var\s+([A-Z][a-zA-Z0-9_]+)|const\s+([A-Z][a-zA-Z0-9_]+))\s*=/g;
  let match;
  
  const seen = new Set<string>();
  
  while ((match = globalRegex.exec(html)) !== null) {
    const globalName = match[1] || match[2] || match[3];
    
    // Skip common globals
    if (isCommonGlobal(globalName)) continue;
    if (seen.has(globalName)) continue;
    
    seen.add(globalName);
    
    patterns.push({
      detectionType: 'global',
      rawValue: globalName,
      context: 'window.' + globalName,
      suggestedName: globalName,
      suggestedCategory: 'JavaScript Library',
    });
  }
  
  return patterns;
}

/**
 * Parse name and version from a string
 */
function parseNameVersion(str: string): { name?: string; version?: string } {
  // Try to match "Name Version" or "Name/Version" or "Name-Version"
  const patterns = [
    /^([A-Za-z0-9\s.]+?)\s+v?([0-9]+\.[0-9.]+)/,  // "WordPress 6.4.2"
    /^([A-Za-z0-9\s.]+?)\/([0-9]+\.[0-9.]+)/,     // "WordPress/6.4.2"
    /^([A-Za-z0-9\s.]+?)-([0-9]+\.[0-9.]+)/,      // "WordPress-6.4.2"
  ];
  
  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) {
      return {
        name: match[1].trim(),
        version: match[2],
      };
    }
  }
  
  // No version found, return whole string as name
  return {
    name: str.trim(),
  };
}

/**
 * Extract name from domain (e.g., "cdn.example.com" -> "Example")
 */
function extractNameFromDomain(domain: string): string {
  const parts = domain.split('.');
  
  // Get the main part (before TLD)
  const mainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  
  // Capitalize first letter
  return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
}

/**
 * Extract name from header key (e.g., "X-Custom-Platform" -> "Custom Platform")
 */
function extractNameFromHeader(header: string): string {
  return header
    .replace(/^x-/i, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract name from attribute (e.g., "data-custom-app" -> "Custom")
 */
function extractNameFromAttribute(attr: string): string {
  return attr
    .replace(/^data-/, '')
    .replace(/-app|-framework|-version/, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Guess category from domain/URL
 */
function guessCategory(domain: string, url: string): string {
  if (domain.includes('analytics') || url.includes('analytics')) return 'Analytics';
  if (domain.includes('tag') || url.includes('gtm')) return 'Tag Manager';
  if (domain.includes('stripe') || domain.includes('payment')) return 'Payment Processor';
  if (domain.includes('chat') || domain.includes('intercom')) return 'Live Chat';
  if (domain.includes('map')) return 'Map Service';
  if (domain.includes('video') || domain.includes('player')) return 'Video Player';
  if (domain.includes('cdn')) return 'CDN';
  
  return 'JavaScript Library';
}

/**
 * Guess category from header name
 */
function guessHeaderCategory(header: string): string {
  const lower = header.toLowerCase();
  
  if (lower.includes('powered') || lower.includes('framework')) return 'Web Framework';
  if (lower.includes('server')) return 'Web Server';
  if (lower.includes('platform') || lower.includes('paas')) return 'PaaS';
  if (lower.includes('cdn')) return 'CDN';
  
  return 'Web Framework';
}

/**
 * Check if pattern matches any known rule
 */
function isKnownPattern(pattern: UnknownPattern): boolean {
  const lowerValue = pattern.rawValue.toLowerCase();
  const lowerName = pattern.suggestedName?.toLowerCase() || '';
  
  // Check against all tech rules
  for (const rule of TECH_RULES) {
    const ruleName = rule.name.toLowerCase();
    
    if (lowerValue.includes(ruleName) || lowerName.includes(ruleName)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if header is already known
 */
function isKnownHeader(header: string): boolean {
  const knownHeaders = [
    'x-powered-by',
    'x-vercel-id',
    'x-vercel-cache',
    'x-nextjs-cache',
    'x-nextjs-page',
    'x-nf-request-id',
    'x-railway-id',
    'x-render-origin-server',
    'x-heroku-queue-wait-time',
    'x-amz-request-id',
    'x-amz-cf-id',
    'x-fastly-request-id',
    'x-akamai-',
    'cf-ray',
    'cf-cache-status',
  ];
  
  return knownHeaders.some(known => header.includes(known));
}

/**
 * Check if server value is already known
 */
function isKnownServer(value: string): boolean {
  const lower = value.toLowerCase();
  const knownServers = ['nginx', 'apache', 'cloudflare', 'vercel', 'netlify', 'caddy', 'iis'];
  
  return knownServers.some(known => lower.includes(known));
}

/**
 * Check if powered-by value is already known
 */
function isKnownPoweredBy(value: string): boolean {
  const lower = value.toLowerCase();
  const knownPowered = ['express', 'node', 'php', 'asp.net', 'wordpress', 'strapi'];
  
  return knownPowered.some(known => lower.includes(known));
}

/**
 * Check if global variable is common/standard
 */
function isCommonGlobal(name: string): boolean {
  const commonGlobals = [
    'React', 'Vue', 'Angular', 'jQuery', 'Stripe', 'PayPal',
    'Google', 'Facebook', 'Twitter', 'Instagram',
    'Window', 'Document', 'Navigator', 'Location',
    'Array', 'Object', 'String', 'Number', 'Boolean',
    'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet',
  ];
  
  return commonGlobals.includes(name);
}
