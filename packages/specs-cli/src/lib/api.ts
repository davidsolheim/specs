import type { AnalysisResponse } from "@sitespecs/contracts";

const API_BASE_URL = process.env.SPECS_API_URL || "https://sitespecs.com";
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_POLL_TIMEOUT_MS = 90_000;

export type { AnalysisResponse } from "@sitespecs/contracts";

export type HostedAnalysisResult = {
  analysis: AnalysisResponse;
  cached?: boolean;
  scannedAt?: string;
  jobId?: string;
  statusUrl?: string;
  message?: string;
  completed: boolean;
  pending: boolean;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeInputUrl(domainOrUrl: string): string {
  const trimmed = domainOrUrl.trim();
  if (!trimmed) {
    throw new Error("Domain or URL is required");
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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

async function waitMs(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function waitForRetryAfter(response: Response): Promise<void> {
  const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
  if (retryAfterMs > 0) {
    await waitMs(retryAfterMs);
  }
}

function extractDomain(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  }
}

function extractHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  }
}

function parseRequested(payload: unknown, fallbackUrl: string, requestedInput: string): AnalysisResponse["requested"] {
  const fallbackRequested = {
    input: requestedInput,
    url: fallbackUrl,
    host: extractHost(fallbackUrl),
  };

  if (!isObjectRecord(payload) || !isObjectRecord(payload.requested)) {
    return fallbackRequested;
  }

  const requested = payload.requested;
  return {
    input: typeof requested.input === "string" ? requested.input : fallbackRequested.input,
    url: typeof requested.url === "string" ? requested.url : fallbackRequested.url,
    host: typeof requested.host === "string" ? requested.host : fallbackRequested.host,
  };
}

function parseRedirects(payload: unknown): AnalysisResponse["redirects"] {
  if (!isObjectRecord(payload) || !isObjectRecord(payload.redirects)) {
    return undefined;
  }

  const redirects = payload.redirects;
  const chain = Array.isArray(redirects.chain)
    ? redirects.chain
        .filter((hop): hop is Record<string, unknown> => isObjectRecord(hop) && typeof hop.url === "string" && typeof hop.host === "string")
        .map((hop) => ({
          url: hop.url as string,
          host: hop.host as string,
          ...(typeof hop.statusCode === "number" ? { statusCode: hop.statusCode } : {}),
        }))
    : [];

  if (typeof redirects.occurred !== "boolean" || typeof redirects.finalUrl !== "string" || typeof redirects.finalHost !== "string") {
    return undefined;
  }

  return {
    occurred: redirects.occurred,
    finalUrl: redirects.finalUrl,
    finalHost: redirects.finalHost,
    chain,
    condensedChain: typeof redirects.condensedChain === "string" ? redirects.condensedChain : "",
  };
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!isObjectRecord(payload)) {
    return fallback;
  }

  const parts: string[] = [];

  if (typeof payload.error === "string") {
    parts.push(payload.error);
  }

  if (typeof payload.message === "string" && payload.message !== payload.error) {
    parts.push(payload.message);
  }

  if (Array.isArray(payload.details)) {
    const firstDetail = payload.details.find((detail) => {
      return isObjectRecord(detail) && typeof detail.message === "string";
    });

    if (isObjectRecord(firstDetail) && typeof firstDetail.message === "string") {
      parts.push(firstDetail.message);
    }
  }

  return parts.length > 0 ? parts.join(": ") : fallback;
}

function toAnalysisResponse(payload: unknown, fallbackUrl: string, requestedInput: string): AnalysisResponse {
  const fallbackDomain = extractDomain(fallbackUrl);
  const requested = parseRequested(payload, fallbackUrl, requestedInput);

  if (!isObjectRecord(payload)) {
    return {
      domain: fallbackDomain,
      url: fallbackUrl,
      status: "unknown",
      technologies: [],
      requested,
    };
  }

  const status =
    payload.status === "online" ||
    payload.status === "offline" ||
    payload.status === "unknown" ||
    payload.status === "analyzing"
      ? payload.status
      : payload.scanning === true || payload.analyzing === true
        ? "analyzing"
        : "unknown";

  const technologies = Array.isArray(payload.technologies)
    ? (payload.technologies as AnalysisResponse["technologies"])
    : [];
  const framework = typeof payload.framework === "string" ? payload.framework : undefined;
  const host = typeof payload.host === "string" ? payload.host : undefined;
  const seo = isObjectRecord(payload.seo) ? (payload.seo as AnalysisResponse["seo"]) : undefined;
  const performance = isObjectRecord(payload.performance)
    ? (payload.performance as AnalysisResponse["performance"])
    : undefined;
  const dns = isObjectRecord(payload.dns) ? payload.dns : undefined;
  const tls = isObjectRecord(payload.tls) ? payload.tls : undefined;
  const onlineSince = typeof payload.onlineSince === "string" ? payload.onlineSince : undefined;
  const lastAnalyzed = typeof payload.lastAnalyzed === "string" ? payload.lastAnalyzed : undefined;
  const redirects = parseRedirects(payload);

  return {
    domain: typeof payload.domain === "string" ? payload.domain : fallbackDomain,
    url: typeof payload.url === "string" ? payload.url : fallbackUrl,
    status,
    technologies,
    requested,
    ...(redirects ? { redirects } : {}),
    ...(framework ? { framework } : {}),
    ...(host ? { host } : {}),
    ...(seo ? { seo } : {}),
    ...(performance ? { performance } : {}),
    ...(dns ? { dns: dns as AnalysisResponse["dns"] } : {}),
    ...(tls ? { tls: tls as AnalysisResponse["tls"] } : {}),
    ...(onlineSince ? { onlineSince } : {}),
    ...(lastAnalyzed ? { lastAnalyzed } : {}),
    ...(payload.scanning === true || payload.analyzing === true ? { analyzing: true } : {}),
  };
}

function normalizeStatusUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  try {
    return new URL(value, API_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function parseHostedAnalysisResult(payload: unknown, fallbackUrl: string, requestedInput: string): HostedAnalysisResult {
  if (isObjectRecord(payload) && payload.success === false) {
    throw new Error(extractErrorMessage(payload, "API error"));
  }

  const dataPayload =
    isObjectRecord(payload) && isObjectRecord(payload.data)
      ? payload.data
      : payload;
  const analysis = toAnalysisResponse(dataPayload, fallbackUrl, requestedInput);

  const cached = isObjectRecord(payload) && typeof payload.cached === "boolean" ? payload.cached : undefined;
  const scannedAt = isObjectRecord(payload) && typeof payload.scannedAt === "string" ? payload.scannedAt : undefined;
  const jobId = isObjectRecord(payload) && typeof payload.jobId === "string" ? payload.jobId : undefined;
  const statusUrl = isObjectRecord(payload) ? normalizeStatusUrl(payload.statusUrl) : undefined;
  const message = isObjectRecord(payload) && typeof payload.message === "string" ? payload.message : undefined;
  const upstreamStatus = isObjectRecord(payload) && typeof payload.status === "string" ? payload.status : undefined;
  const upstreamPending =
    upstreamStatus === "queued" || upstreamStatus === "processing" || upstreamStatus === "analyzing";
  const completed =
    (isObjectRecord(payload) && payload.completed === true) ||
    cached === true ||
    upstreamStatus === "completed" ||
    (!upstreamPending && analysis.status !== "analyzing" && analysis.analyzing !== true);
  const pending =
    !completed &&
    ((isObjectRecord(payload) && payload.scanning === true) ||
      upstreamPending ||
      analysis.status === "analyzing" ||
      analysis.analyzing === true);

  return {
    analysis,
    ...(cached !== undefined ? { cached } : {}),
    ...(scannedAt ? { scannedAt } : {}),
    ...(jobId ? { jobId } : {}),
    ...(statusUrl ? { statusUrl } : {}),
    ...(message ? { message } : {}),
    completed,
    pending,
  };
}

async function fetchJson(
  url: string,
  options?: { notFoundMessage?: string },
): Promise<{ response: Response; payload: unknown }> {
  let response: Response | undefined;
  const maxAttempts = 2;
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 528, 530]);
  const retryableNetworkCodes = new Set(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH", "ECONNREFUSED"]);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "specs-cli/0.1.0",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timed out: SiteSpecs API did not respond in time");
      }

      if (error instanceof TypeError) {
        const typeErrorWithCause = error as TypeError & { cause?: { code?: string } };
        const networkCode = typeErrorWithCause.cause?.code;

        if (networkCode && retryableNetworkCodes.has(networkCode) && attempt < maxAttempts) {
          continue;
        }

        if (networkCode === "ENOTFOUND") {
          throw new Error("DNS error: unable to resolve SiteSpecs API host");
        }

        if (networkCode === "EAI_AGAIN") {
          throw new Error("DNS temporarily unavailable: retry SiteSpecs API lookup shortly");
        }

        if (networkCode === "ECONNRESET") {
          throw new Error("Connection reset: SiteSpecs API connection was interrupted");
        }

        if (networkCode === "ETIMEDOUT") {
          throw new Error("Connection timed out: SiteSpecs API connection attempt exceeded the timeout window");
        }

        if (networkCode === "EHOSTUNREACH" || networkCode === "ENETUNREACH") {
          throw new Error("Route unreachable: unable to reach SiteSpecs API network");
        }

        if (networkCode === "ECONNREFUSED") {
          throw new Error("Connection refused: SiteSpecs API is not accepting connections");
        }

        if (networkCode === "CERT_HAS_EXPIRED") {
          throw new Error("TLS certificate expired: SiteSpecs API certificate is no longer valid");
        }

        if (networkCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
          throw new Error("TLS verification failed: unable to verify SiteSpecs API certificate chain");
        }

        if (networkCode === "DEPTH_ZERO_SELF_SIGNED_CERT") {
          throw new Error("TLS trust failure: SiteSpecs API returned a self-signed certificate");
        }

        if (networkCode === "ERR_TLS_CERT_ALTNAME_INVALID") {
          throw new Error("TLS hostname mismatch: SiteSpecs API certificate does not match the requested host");
        }

        if (networkCode === "CERT_REVOKED") {
          throw new Error("TLS certificate revoked: SiteSpecs API certificate has been revoked by its issuer");
        }

        if (networkCode === "CERT_SIGNATURE_FAILURE") {
          throw new Error("TLS certificate signature failure: SiteSpecs API certificate signature validation failed");
        }

        if (networkCode === "ERR_SSL_WRONG_VERSION_NUMBER") {
          throw new Error("TLS protocol mismatch: SiteSpecs API rejected the negotiated TLS version");
        }

        if (networkCode === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY") {
          throw new Error("TLS issuer validation failed: unable to retrieve SiteSpecs API issuer certificate locally");
        }

        if (networkCode === "UNABLE_TO_GET_ISSUER_CERT") {
          throw new Error("TLS issuer certificate missing: unable to retrieve SiteSpecs API issuer certificate");
        }

        if (networkCode === "UNABLE_TO_DECRYPT_CERT_SIGNATURE") {
          throw new Error("TLS certificate signature decode failure: unable to decrypt SiteSpecs API certificate signature");
        }

        if (networkCode === "CERT_CHAIN_TOO_LONG") {
          throw new Error("TLS certificate chain too long: SiteSpecs API certificate chain exceeds validation depth");
        }

        if (networkCode === "SELF_SIGNED_CERT_IN_CHAIN") {
          throw new Error("TLS trust chain failure: SiteSpecs API certificate chain includes a self-signed certificate");
        }

        if (networkCode === "CERT_NOT_YET_VALID") {
          throw new Error("TLS certificate not yet valid: SiteSpecs API certificate validity window has not started");
        }

        throw new Error("Network error: unable to reach SiteSpecs API");
      }

      throw error;
    }

    if (!retryableStatuses.has(response.status) || attempt === maxAttempts) {
      break;
    }

    await waitForRetryAfter(response);
  }

  if (!response) {
    throw new Error("Network error: unable to reach SiteSpecs API");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(options?.notFoundMessage || `Domain not found: ${url}`);
    }

    if (response.status === 429) {
      const message = extractErrorMessage(payload, "SiteSpecs API throttled this request (HTTP 429)");
      throw new Error(`Rate limited: ${message}`);
    }

    const message = extractErrorMessage(payload, `${response.status} ${response.statusText}`);
    throw new Error(`API error: ${message}`);
  }

  return { response, payload };
}

async function requestHostedAnalysis(domain: string): Promise<HostedAnalysisResult> {
  const normalizedUrl = normalizeInputUrl(domain);
  const requestUrl = `${API_BASE_URL}/api/public/analyze?url=${encodeURIComponent(normalizedUrl)}`;
  const { payload } = await fetchJson(requestUrl, {
    notFoundMessage: `Domain not found: ${domain}`,
  });
  return parseHostedAnalysisResult(payload, normalizedUrl, domain.trim());
}

export async function pollHostedAnalysis(
  statusUrl: string,
  options?: { requestedInput?: string; requestedUrl?: string },
): Promise<HostedAnalysisResult> {
  const { payload } = await fetchJson(statusUrl);
  return parseHostedAnalysisResult(
    payload,
    options?.requestedUrl ?? statusUrl,
    options?.requestedInput ?? options?.requestedUrl ?? statusUrl,
  );
}

export async function fetchHostedAnalysis(
  domain: string,
  options?: { pollIntervalMs?: number; timeoutMs?: number },
): Promise<HostedAnalysisResult> {
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const normalizedUrl = normalizeInputUrl(domain);
  let current = await requestHostedAnalysis(domain);

  if (!current.pending || !current.statusUrl) {
    return current;
  }

  const deadline = Date.now() + timeoutMs;
  while (current.pending && current.statusUrl && Date.now() < deadline) {
    await waitMs(pollIntervalMs);
    current = await pollHostedAnalysis(current.statusUrl, {
      requestedInput: domain.trim(),
      requestedUrl: normalizedUrl,
    });
  }

  return current;
}

/**
 * Fetch website analysis from SiteSpecs API without polling.
 */
export async function fetchAnalysis(domain: string): Promise<AnalysisResponse> {
  return (await requestHostedAnalysis(domain)).analysis;
}

export const fetchCloudAnalysis = fetchAnalysis;

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "N/A";

  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format date to relative time
 */
export function formatRelativeTime(date: string | null | undefined): string {
  if (!date) return "Unknown";

  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}
