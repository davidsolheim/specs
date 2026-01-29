const API_BASE_URL = process.env.SITESPECS_API_URL || 'https://api.sitespecs.com';

export interface WebsiteAnalysis {
  domain: string;
  url: string;
  status: 'online' | 'offline';
  
  // Technology stack
  technologies: {
    category: string;
    name: string;
    version?: string;
    confidence: string;
    icon?: string;
  }[];
  
  // Performance metrics
  performance: {
    loadTime: number;
    pageSize: number;
    requestCount: number;
    responseTime: number;
    lcp?: number;
    fid?: number;
    cls?: number;
  };
  
  // SEO data
  seo: {
    title?: string;
    description?: string;
    h1?: string;
    canonical?: string;
    openGraph: boolean;
    twitterCard: boolean;
    structuredData: number;
  };
  
  // Hosting info
  hosting: {
    server?: string;
    ip?: string;
    location?: string;
    cdn?: string;
    ssl: {
      valid: boolean;
      issuer?: string;
      expiresAt?: string;
      daysUntilExpiry?: number;
    };
  };
  
  // Domain info
  domain_info: {
    registeredAt?: string;
    age?: string;
    registrar?: string;
  };
  
  lastChecked: string;
}

export async function getWebsiteAnalysis(domain: string): Promise<WebsiteAnalysis> {
  // For now, this will call the sitespecs.com API
  // In the future, this could also query the Neon database directly for cached results
  
  const response = await fetch(`${API_BASE_URL}/v1/analyze?domain=${encodeURIComponent(domain)}`, {
    headers: {
      'User-Agent': 'specs-cli/0.1.0',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Website not found: ${domain}`);
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();
  return data;
}
