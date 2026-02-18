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

function normalizeInputUrl(domainOrUrl: string): string {
  const trimmed = domainOrUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function parseRetryAfterMs(retryAfterHeader: string | null): number {
  if (!retryAfterHeader) {
    return 0;
  }

  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.floor(seconds * 1000), 10_000);
  }

  const retryAt = Date.parse(retryAfterHeader);
  if (!Number.isNaN(retryAt)) {
    const deltaMs = retryAt - Date.now();
    if (deltaMs > 0) {
      return Math.min(deltaMs, 10_000);
    }
  }

  return 0;
}

async function waitForRetryAfter(response: Response): Promise<void> {
  const waitMs = parseRetryAfterMs(response.headers.get('retry-after'));
  if (waitMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, waitMs);
  });
}

/**
 * Fetch website analysis from sitespecs.com API
 */
export async function fetchAnalysis(domain: string): Promise<AnalysisResponse> {
  const normalizedUrl = normalizeInputUrl(domain);
  const url = `${API_BASE_URL}/api/public/analyze?url=${encodeURIComponent(normalizedUrl)}`;

  let response: Response | undefined;
  const maxAttempts = 2;
  const retryableStatuses = new Set([429, 502, 503, 504]);
  const retryableNetworkCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNREFUSED']);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'specs-cli/0.1.0',
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out: SiteSpecs API did not respond in time');
      }

      if (error instanceof TypeError) {
        const typeErrorWithCause = error as TypeError & { cause?: { code?: string } };
        const networkCode = typeErrorWithCause.cause?.code;

        if (networkCode && retryableNetworkCodes.has(networkCode) && attempt < maxAttempts) {
          continue;
        }

        if (networkCode === 'ENOTFOUND') {
          throw new Error('DNS error: unable to resolve SiteSpecs API host');
        }

        if (networkCode === 'EAI_AGAIN') {
          throw new Error('DNS temporarily unavailable: retry SiteSpecs API lookup shortly');
        }

        if (networkCode === 'ECONNRESET') {
          throw new Error('Connection reset: SiteSpecs API connection was interrupted');
        }

        if (networkCode === 'ETIMEDOUT') {
          throw new Error('Connection timed out: SiteSpecs API connection attempt exceeded the timeout window');
        }

        if (
          typeErrorWithCause.cause?.code === 'EHOSTUNREACH' ||
          typeErrorWithCause.cause?.code === 'ENETUNREACH'
        ) {
          throw new Error('Route unreachable: unable to reach SiteSpecs API network');
        }

        if (typeErrorWithCause.cause?.code === 'ECONNREFUSED') {
          throw new Error('Connection refused: SiteSpecs API is not accepting connections');
        }

        if (typeErrorWithCause.cause?.code === 'CERT_HAS_EXPIRED') {
          throw new Error('TLS certificate expired: SiteSpecs API certificate is no longer valid');
        }

        if (typeErrorWithCause.cause?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
          throw new Error('TLS verification failed: unable to verify SiteSpecs API certificate chain');
        }

        if (typeErrorWithCause.cause?.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
          throw new Error('TLS trust failure: SiteSpecs API returned a self-signed certificate');
        }

        if (typeErrorWithCause.cause?.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
          throw new Error('TLS hostname mismatch: SiteSpecs API certificate does not match the requested host');
        }

        if (typeErrorWithCause.cause?.code === 'CERT_REVOKED') {
          throw new Error('TLS certificate revoked: SiteSpecs API certificate has been revoked by its issuer');
        }

        if (typeErrorWithCause.cause?.code === 'CERT_SIGNATURE_FAILURE') {
          throw new Error('TLS certificate signature failure: SiteSpecs API certificate signature validation failed');
        }

        if (typeErrorWithCause.cause?.code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
          throw new Error('TLS protocol mismatch: SiteSpecs API rejected the negotiated TLS version');
        }

        if (typeErrorWithCause.cause?.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY') {
          throw new Error('TLS issuer validation failed: unable to retrieve SiteSpecs API issuer certificate locally');
        }

        if (typeErrorWithCause.cause?.code === 'UNABLE_TO_GET_ISSUER_CERT') {
          throw new Error('TLS issuer certificate missing: unable to retrieve SiteSpecs API issuer certificate');
        }

        if (typeErrorWithCause.cause?.code === 'UNABLE_TO_DECRYPT_CERT_SIGNATURE') {
          throw new Error('TLS certificate signature decode failure: unable to decrypt SiteSpecs API certificate signature');
        }

        if (typeErrorWithCause.cause?.code === 'CERT_CHAIN_TOO_LONG') {
          throw new Error('TLS certificate chain too long: SiteSpecs API certificate chain exceeds validation depth');
        }

        if (typeErrorWithCause.cause?.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
          throw new Error('TLS trust chain failure: SiteSpecs API certificate chain includes a self-signed certificate');
        }

        if (typeErrorWithCause.cause?.code === 'CERT_NOT_YET_VALID') {
          throw new Error('TLS certificate not yet valid: SiteSpecs API certificate validity window has not started');
        }

        throw new Error('Network error: unable to reach SiteSpecs API');
      }

      throw error;
    }

    if (!retryableStatuses.has(response.status) || attempt === maxAttempts) {
      break;
    }

    await waitForRetryAfter(response);
  }

  if (!response) {
    throw new Error('Network error: unable to reach SiteSpecs API');
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Domain not found: ${domain}`);
    }

    if (response.status === 429) {
      throw new Error('Rate limited: SiteSpecs API throttled this request (HTTP 429)');
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
