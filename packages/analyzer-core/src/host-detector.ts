/**
 * Host Detection via IP Ranges and Hostnames
 * Identifies hosting providers by resolving domain to IP and checking against known ranges
 */

import { TechCategory } from './tech-rules.js';

export interface HostDetection {
  name: string;
  category: TechCategory;
  confidence: 'high' | 'medium' | 'low';
  detectionMethod: 'ip-range' | 'hostname' | 'reverse-dns';
  ip?: string;
  hostname?: string;
}

/**
 * Known IP ranges for major hosting providers
 * Format: CIDR notation (e.g., "192.168.1.0/24")
 */
interface IPRange {
  provider: string;
  category: TechCategory;
  ranges: string[];
}

const KNOWN_IP_RANGES: IPRange[] = [
  // AWS (Amazon Web Services)
  {
    provider: 'AWS',
    category: TechCategory.HOSTING,
    ranges: [
      // US East (N. Virginia)
      '3.208.0.0/12',
      '3.224.0.0/12',
      '18.204.0.0/14',
      '18.208.0.0/13',
      '52.0.0.0/11',
      '52.70.0.0/15',
      '52.86.0.0/15',
      '54.144.0.0/12',
      '54.160.0.0/12',
      '54.204.0.0/14',
      '54.208.0.0/13',
      // CloudFront
      '13.32.0.0/15',
      '13.35.0.0/16',
      '13.224.0.0/14',
      // Add more AWS ranges as needed
    ],
  },
  
  // Google Cloud Platform
  {
    provider: 'Google Cloud',
    category: TechCategory.HOSTING,
    ranges: [
      '34.64.0.0/10',
      '35.184.0.0/13',
      '35.192.0.0/12',
      '35.208.0.0/12',
      '35.224.0.0/12',
      '35.240.0.0/13',
      '104.154.0.0/15',
      '104.196.0.0/14',
      '107.167.160.0/19',
      '107.178.192.0/18',
      '130.211.0.0/16',
      '146.148.0.0/17',
    ],
  },
  
  // DigitalOcean
  {
    provider: 'DigitalOcean',
    category: TechCategory.HOSTING,
    ranges: [
      '104.131.0.0/16',
      '104.236.0.0/16',
      '107.170.0.0/16',
      '138.197.0.0/16',
      '138.68.0.0/16',
      '139.59.0.0/16',
      '142.93.0.0/16',
      '143.110.0.0/16',
      '157.230.0.0/16',
      '159.65.0.0/16',
      '159.89.0.0/16',
      '161.35.0.0/16',
      '162.243.0.0/16',
      '164.90.0.0/16',
      '165.22.0.0/16',
      '165.227.0.0/16',
      '167.71.0.0/16',
      '167.99.0.0/16',
      '167.172.0.0/16',
      '178.62.0.0/16',
      '188.166.0.0/16',
      '188.226.0.0/16',
      '192.241.0.0/16',
      '206.189.0.0/16',
      '207.154.0.0/16',
    ],
  },
  
  // Cloudflare
  {
    provider: 'Cloudflare',
    category: TechCategory.CDN,
    ranges: [
      '103.21.244.0/22',
      '103.22.200.0/22',
      '103.31.4.0/22',
      '104.16.0.0/13',
      '104.24.0.0/14',
      '108.162.192.0/18',
      '131.0.72.0/22',
      '141.101.64.0/18',
      '162.158.0.0/15',
      '172.64.0.0/13',
      '173.245.48.0/20',
      '188.114.96.0/20',
      '190.93.240.0/20',
      '197.234.240.0/22',
      '198.41.128.0/17',
    ],
  },
  
  // Linode
  {
    provider: 'Linode',
    category: TechCategory.HOSTING,
    ranges: [
      '45.33.0.0/16',
      '45.56.0.0/16',
      '45.79.0.0/16',
      '50.116.0.0/16',
      '66.175.208.0/20',
      '66.228.32.0/19',
      '69.164.192.0/19',
      '72.14.176.0/20',
      '74.207.224.0/19',
      '85.90.244.0/22',
      '96.126.96.0/19',
      '97.107.128.0/18',
      '106.187.32.0/19',
      '139.162.0.0/16',
      '172.104.0.0/15',
      '173.230.128.0/19',
      '173.255.192.0/18',
      '176.58.96.0/19',
      '178.79.128.0/17',
      '192.155.80.0/20',
      '198.58.96.0/19',
      '212.71.232.0/21',
    ],
  },
  
  // Hetzner
  {
    provider: 'Hetzner',
    category: TechCategory.HOSTING,
    ranges: [
      '5.9.0.0/16',
      '46.4.0.0/16',
      '78.46.0.0/15',
      '88.198.0.0/16',
      '88.99.0.0/16',
      '94.130.0.0/16',
      '95.216.0.0/16',
      '116.202.0.0/16',
      '135.181.0.0/16',
      '136.243.0.0/16',
      '138.201.0.0/16',
      '142.132.128.0/17',
      '144.76.0.0/16',
      '148.251.0.0/16',
      '159.69.0.0/16',
      '162.55.0.0/16',
      '167.233.0.0/16',
      '168.119.0.0/16',
      '176.9.0.0/16',
      '178.63.0.0/16',
      '188.34.128.0/17',
      '188.40.0.0/16',
      '195.201.0.0/16',
      '213.133.96.0/19',
    ],
  },
  
  // OVH
  {
    provider: 'OVH',
    category: TechCategory.HOSTING,
    ranges: [
      '5.135.0.0/16',
      '5.196.0.0/16',
      '37.59.0.0/16',
      '46.105.0.0/16',
      '51.38.0.0/16',
      '51.68.0.0/16',
      '51.75.0.0/16',
      '51.77.0.0/16',
      '51.79.0.0/16',
      '51.81.0.0/16',
      '51.83.0.0/16',
      '51.89.0.0/16',
      '51.91.0.0/16',
      '54.36.0.0/16',
      '54.37.0.0/16',
      '54.38.0.0/16',
      '91.121.0.0/16',
      '92.222.0.0/16',
      '94.23.0.0/16',
      '135.125.0.0/16',
      '137.74.0.0/16',
      '141.94.0.0/16',
      '141.95.0.0/16',
      '144.217.0.0/16',
      '145.239.0.0/16',
      '146.59.0.0/16',
      '147.135.0.0/16',
      '151.80.0.0/16',
      '152.228.128.0/17',
      '158.69.0.0/16',
      '164.132.0.0/16',
      '167.114.0.0/16',
      '176.31.0.0/16',
      '178.32.0.0/16',
      '188.165.0.0/16',
      '192.95.0.0/16',
      '192.99.0.0/16',
      '198.27.64.0/18',
      '198.50.128.0/17',
      '199.231.188.0/22',
      '213.32.0.0/16',
      '213.186.32.0/19',
      '213.251.128.0/18',
    ],
  },
];

/**
 * Known hostname patterns for hosting providers
 */
interface HostnamePattern {
  provider: string;
  category: TechCategory;
  patterns: RegExp[];
}

const HOSTNAME_PATTERNS: HostnamePattern[] = [
  {
    provider: 'AWS',
    category: TechCategory.HOSTING,
    patterns: [
      /\.amazonaws\.com$/i,
      /\.aws\.amazon\.com$/i,
      /\.compute\.amazonaws\.com$/i,
      /\.ec2\.amazonaws\.com$/i,
      /\.elb\.amazonaws\.com$/i,
      /\.cloudfront\.net$/i,
    ],
  },
  {
    provider: 'Google Cloud',
    category: TechCategory.HOSTING,
    patterns: [
      /\.googleusercontent\.com$/i,
      /\.googleapis\.com$/i,
      /\.appspot\.com$/i,
      /\.cloudfunctions\.net$/i,
      /\.run\.app$/i,
    ],
  },
  {
    provider: 'Azure',
    category: TechCategory.HOSTING,
    patterns: [
      /\.azurewebsites\.net$/i,
      /\.azure\.com$/i,
      /\.cloudapp\.azure\.com$/i,
      /\.azureedge\.net$/i,
      /\.windows\.net$/i,
    ],
  },
  {
    provider: 'DigitalOcean',
    category: TechCategory.HOSTING,
    patterns: [
      /\.digitaloceanspaces\.com$/i,
      /\.ondigitalocean\.app$/i,
    ],
  },
  {
    provider: 'Vercel',
    category: TechCategory.PAAS,
    patterns: [
      /\.vercel\.app$/i,
      /\.vercel-dns\.com$/i,
      /\.now\.sh$/i,
    ],
  },
  {
    provider: 'Netlify',
    category: TechCategory.PAAS,
    patterns: [
      /\.netlify\.app$/i,
      /\.netlify\.com$/i,
    ],
  },
  {
    provider: 'Heroku',
    category: TechCategory.PAAS,
    patterns: [
      /\.herokuapp\.com$/i,
      /\.herokussl\.com$/i,
    ],
  },
  {
    provider: 'Railway',
    category: TechCategory.PAAS,
    patterns: [
      /\.railway\.app$/i,
      /\.up\.railway\.app$/i,
    ],
  },
  {
    provider: 'Render',
    category: TechCategory.PAAS,
    patterns: [
      /\.onrender\.com$/i,
      /\.render\.com$/i,
    ],
  },
  {
    provider: 'Fly.io',
    category: TechCategory.PAAS,
    patterns: [
      /\.fly\.dev$/i,
      /\.fly\.io$/i,
    ],
  },
  {
    provider: 'Cloudflare Pages',
    category: TechCategory.PAAS,
    patterns: [
      /\.pages\.dev$/i,
    ],
  },
  {
    provider: 'GitHub Pages',
    category: TechCategory.PAAS,
    patterns: [
      /\.github\.io$/i,
    ],
  },
  {
    provider: 'GitLab Pages',
    category: TechCategory.PAAS,
    patterns: [
      /\.gitlab\.io$/i,
    ],
  },
  {
    provider: 'Cloudflare',
    category: TechCategory.CDN,
    patterns: [
      /\.cloudflare\.com$/i,
      /\.cloudflare\.net$/i,
    ],
  },
  {
    provider: 'Fastly',
    category: TechCategory.CDN,
    patterns: [
      /\.fastly\.net$/i,
      /\.fastlylb\.net$/i,
    ],
  },
  {
    provider: 'Akamai',
    category: TechCategory.CDN,
    patterns: [
      /\.akamai\.net$/i,
      /\.akamaitechnologies\.com$/i,
      /\.akamaiedge\.net$/i,
    ],
  },
];

/**
 * Detect hosting provider from URL
 */
export async function detectHostFromURL(url: string): Promise<HostDetection | null> {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // 1. Check hostname patterns first (fastest)
    const hostnameMatch = detectFromHostname(hostname);
    if (hostnameMatch) {
      return hostnameMatch;
    }
    
    // 2. Try to resolve IP and check ranges
    // Note: DNS resolution in Node.js
    const ipMatch = await detectFromIP(hostname);
    if (ipMatch) {
      return ipMatch;
    }
    
    return null;
  } catch (error) {
    console.error('[Host Detector] Error detecting host:', error);
    return null;
  }
}

/**
 * Detect from hostname patterns
 */
function detectFromHostname(hostname: string): HostDetection | null {
  for (const pattern of HOSTNAME_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(hostname)) {
        return {
          name: pattern.provider,
          category: pattern.category,
          confidence: 'high',
          detectionMethod: 'hostname',
          hostname,
        };
      }
    }
  }
  
  return null;
}

/**
 * Detect from IP address ranges
 */
async function detectFromIP(hostname: string): Promise<HostDetection | null> {
  try {
    // Use Node.js dns module to resolve hostname
    const dns = await import('dns/promises');
    const addresses = await dns.resolve4(hostname);
    
    if (addresses.length === 0) {
      return null;
    }
    
    const ip = addresses[0];
    
    // Check against known IP ranges
    for (const range of KNOWN_IP_RANGES) {
      for (const cidr of range.ranges) {
        if (isIPInRange(ip, cidr)) {
          return {
            name: range.provider,
            category: range.category,
            confidence: 'high',
            detectionMethod: 'ip-range',
            ip,
            hostname,
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    // DNS resolution failed or not available
    return null;
  }
}

/**
 * Check if IP is in CIDR range
 */
function isIPInRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * Get all possible hosting providers for an IP
 */
export async function getAllHostsForIP(ip: string): Promise<string[]> {
  const hosts: string[] = [];
  
  for (const range of KNOWN_IP_RANGES) {
    for (const cidr of range.ranges) {
      if (isIPInRange(ip, cidr)) {
        hosts.push(range.provider);
        break;
      }
    }
  }
  
  return hosts;
}

/**
 * Reverse DNS lookup to get hostname from IP
 */
export async function reverseDNS(ip: string): Promise<string | null> {
  try {
    const dns = await import('dns/promises');
    const hostnames = await dns.reverse(ip);
    return hostnames.length > 0 ? hostnames[0] : null;
  } catch {
    return null;
  }
}
