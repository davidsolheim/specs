const API_BASE_URL = process.env.SPECS_API_URL || 'https://sitespecs.com';

export interface AnalysisResponse {
  domain: string;
  url: string;
  status: 'online' | 'offline' | 'unknown' | 'analyzing';
  technologies: Array<{
    name: string;
    version?: string;
    category: string;
    confidence: string;
    icon?: string;
    website?: string;
  }>;
  framework?: string;
  host?: string;
  seo?: {
    score?: number | null;
    title?: string;
    description?: string;
    hasSSL?: boolean;
    mobileOptimized?: boolean;
    wordCount?: number | null;
  };
  performance?: {
    responseTime?: number | null;
    pageSize?: number | null;
    statusCode?: number | null;
  };
  onlineSince?: string;
  lastAnalyzed?: string;
  analyzing?: boolean;
}

/**
 * Fetch website analysis from sitespecs.com API
 */
export async function fetchAnalysis(domain: string): Promise<AnalysisResponse> {
  const url = `${API_BASE_URL}/api/public/analyze?url=${encodeURIComponent(domain)}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'specs-cli/0.1.0',
    },
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Domain not found: ${domain}`);
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data as AnalysisResponse;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return 'N/A';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format date to relative time
 */
export function formatRelativeTime(date: string | null | undefined): string {
  if (!date) return 'Unknown';
  
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}
