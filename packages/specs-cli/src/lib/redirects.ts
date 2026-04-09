import type { AnalysisResponse } from "./api.js";

function comparableHost(host?: string): string | undefined {
  return host?.trim().toLowerCase().replace(/^www\./i, "");
}

function finalDisplayHost(host?: string): string | undefined {
  return host?.trim().replace(/^www\./i, "");
}

function extractHost(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function hasPureSameHostSchemeUpgrade(data: AnalysisResponse): boolean {
  const chain = data.redirects?.chain ?? [];
  if (chain.length !== 2) {
    return false;
  }

  try {
    const first = new URL(chain[0].url);
    const second = new URL(chain[1].url);

    return (
      first.hostname.toLowerCase() === second.hostname.toLowerCase() &&
      first.pathname === second.pathname &&
      first.search === second.search &&
      first.hash === second.hash &&
      first.protocol !== second.protocol
    );
  } catch {
    return false;
  }
}

function hasMeaningfulHostnameHop(data: AnalysisResponse): boolean {
  const rawHosts = Array.from(
    new Set((data.redirects?.chain ?? []).map((hop) => hop.host.trim().toLowerCase()).filter(Boolean)),
  );

  return rawHosts.length > 1;
}

export function getRedirectSummaryChain(data: AnalysisResponse): string | undefined {
  if (!data.redirects?.occurred || !data.redirects.condensedChain) {
    return undefined;
  }

  return data.redirects.condensedChain.replace(/\s*->\s*/g, "->");
}

export function getRedirectDisplayNote(data: AnalysisResponse): string | undefined {
  const requestedHost = data.requested?.host;
  const finalHost = data.redirects?.finalHost ?? extractHost(data.url);

  if (data.redirects?.occurred) {
    if (hasPureSameHostSchemeUpgrade(data)) {
      return undefined;
    }

    if (data.redirects.condensedChain && (hasMeaningfulHostnameHop(data) || comparableHost(requestedHost) !== comparableHost(finalHost))) {
      return `Redirected: ${data.redirects.condensedChain}`;
    }
  }

  if (!requestedHost || !finalHost) {
    return undefined;
  }

  if (comparableHost(requestedHost) === comparableHost(finalHost)) {
    return undefined;
  }

  return `Redirected to ${finalDisplayHost(finalHost)}`;
}
