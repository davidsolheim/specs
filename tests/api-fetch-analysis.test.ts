import { afterEach, describe, expect, mock, test } from 'bun:test';
import { fetchAnalysis } from '../src/lib/api';

describe('fetchAnalysis deterministic behavior fixtures', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restore();
  });

  test('smoke: builds analyze URL, sets User-Agent, and returns API payload', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
    };

    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain('/api/public/analyze?url=https%3A%2F%2Fexample.com');
      expect(init?.headers).toEqual({ 'User-Agent': 'specs-cli/0.1.0' });
      return new Response(JSON.stringify(payload), { status: 200 });
    });

    global.fetch = fetchMock as typeof fetch;

    const result = await fetchAnalysis('example.com');
    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('smoke: preserves full https URL input', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
    };

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/api/public/analyze?url=https%3A%2F%2Fexample.com');
      return new Response(JSON.stringify(payload), { status: 200 });
    });

    global.fetch = fetchMock as typeof fetch;

    const result = await fetchAnalysis('https://example.com');
    expect(result).toEqual(payload);
  });

  test('failure: returns domain-not-found error on 404', async () => {
    global.fetch = mock(async () => new Response('not found', { status: 404, statusText: 'Not Found' })) as typeof fetch;

    await expect(fetchAnalysis('missing.example')).rejects.toThrow('Domain not found: missing.example');
  });

  test('failure: returns API status error on non-404 non-2xx', async () => {
    global.fetch = mock(async () => new Response('boom', { status: 503, statusText: 'Service Unavailable' })) as typeof fetch;

    await expect(fetchAnalysis('example.com')).rejects.toThrow('API error: 503 Service Unavailable');
  });

  test('failure: retries once then returns deterministic rate-limit error on repeated 429', async () => {
    const fetchMock = mock(async () => new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }));
    global.fetch = fetchMock as typeof fetch;

    await expect(fetchAnalysis('example.com')).rejects.toThrow('Rate limited: SiteSpecs API throttled this request (HTTP 429)');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('reliability: succeeds on second attempt when first attempt is 429', async () => {
    const payload = {
      domain: 'example.com',
      url: 'https://example.com',
      status: 'online',
      technologies: [],
    };

    const fetchMock = mock(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return new Response('rate limited', { status: 429, statusText: 'Too Many Requests' });
      }

      return new Response(JSON.stringify(payload), { status: 200 });
    });

    global.fetch = fetchMock as typeof fetch;

    const result = await fetchAnalysis('example.com');
    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('failure: maps network errors to deterministic message', async () => {
    global.fetch = mock(async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;

    await expect(fetchAnalysis('example.com')).rejects.toThrow('Network error: unable to reach SiteSpecs API');
  });

  test('failure: maps timeout aborts to deterministic message', async () => {
    global.fetch = mock(async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }) as typeof fetch;

    await expect(fetchAnalysis('example.com')).rejects.toThrow('Request timed out: SiteSpecs API did not respond in time');
  });

  test('failure: maps DNS ENOTFOUND errors to deterministic message', async () => {
    global.fetch = mock(async () => {
      const dnsError = new TypeError('fetch failed');
      (dnsError as TypeError & { cause?: { code?: string } }).cause = { code: 'ENOTFOUND' };
      throw dnsError;
    }) as typeof fetch;

    await expect(fetchAnalysis('missing-host.invalid')).rejects.toThrow('DNS error: unable to resolve SiteSpecs API host');
  });

  test('failure: maps connection reset ECONNRESET errors to deterministic message', async () => {
    global.fetch = mock(async () => {
      const resetError = new TypeError('fetch failed');
      (resetError as TypeError & { cause?: { code?: string } }).cause = { code: 'ECONNRESET' };
      throw resetError;
    }) as typeof fetch;

    await expect(fetchAnalysis('flaky.example.com')).rejects.toThrow('Connection reset: SiteSpecs API connection was interrupted');
  });

  test('failure: maps unreachable route EHOSTUNREACH errors to deterministic message', async () => {
    global.fetch = mock(async () => {
      const unreachableError = new TypeError('fetch failed');
      (unreachableError as TypeError & { cause?: { code?: string } }).cause = { code: 'EHOSTUNREACH' };
      throw unreachableError;
    }) as typeof fetch;

    await expect(fetchAnalysis('isolated-network.example')).rejects.toThrow('Route unreachable: unable to reach SiteSpecs API network');
  });

  test('failure: maps refused connection ECONNREFUSED errors to deterministic message', async () => {
    global.fetch = mock(async () => {
      const refusedError = new TypeError('fetch failed');
      (refusedError as TypeError & { cause?: { code?: string } }).cause = { code: 'ECONNREFUSED' };
      throw refusedError;
    }) as typeof fetch;

    await expect(fetchAnalysis('closed-port.example')).rejects.toThrow('Connection refused: SiteSpecs API is not accepting connections');
  });

  test('failure: maps expired certificate CERT_HAS_EXPIRED errors to deterministic message', async () => {
    global.fetch = mock(async () => {
      const expiredCertError = new TypeError('fetch failed');
      (expiredCertError as TypeError & { cause?: { code?: string } }).cause = { code: 'CERT_HAS_EXPIRED' };
      throw expiredCertError;
    }) as typeof fetch;

    await expect(fetchAnalysis('expired-cert.example')).rejects.toThrow('TLS certificate expired: SiteSpecs API certificate is no longer valid');
  });

  test('failure: maps unverified certificate UNABLE_TO_VERIFY_LEAF_SIGNATURE errors to deterministic message', async () => {
    global.fetch = mock(async () => {
      const unverifiedCertError = new TypeError('fetch failed');
      (unverifiedCertError as TypeError & { cause?: { code?: string } }).cause = { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' };
      throw unverifiedCertError;
    }) as typeof fetch;

    await expect(fetchAnalysis('untrusted-cert.example')).rejects.toThrow('TLS verification failed: unable to verify SiteSpecs API certificate chain');
  });

  test('failure: maps self-signed certificate DEPTH_ZERO_SELF_SIGNED_CERT errors to deterministic message', async () => {
    global.fetch = mock(async () => {
      const selfSignedCertError = new TypeError('fetch failed');
      (selfSignedCertError as TypeError & { cause?: { code?: string } }).cause = { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' };
      throw selfSignedCertError;
    }) as typeof fetch;

    await expect(fetchAnalysis('self-signed-cert.example')).rejects.toThrow('TLS trust failure: SiteSpecs API returned a self-signed certificate');
  });

  test('failure: maps TLS hostname mismatch ERR_TLS_CERT_ALTNAME_INVALID errors to deterministic message', async () => {
    global.fetch = mock(async () => {
      const hostnameMismatchError = new TypeError('fetch failed');
      (hostnameMismatchError as TypeError & { cause?: { code?: string } }).cause = { code: 'ERR_TLS_CERT_ALTNAME_INVALID' };
      throw hostnameMismatchError;
    }) as typeof fetch;

    await expect(fetchAnalysis('hostname-mismatch-cert.example')).rejects.toThrow('TLS hostname mismatch: SiteSpecs API certificate does not match the requested host');
  });

  test('failure: maps revoked certificate CERT_REVOKED errors to deterministic message', async () => {
    global.fetch = mock(async () => {
      const revokedCertError = new TypeError('fetch failed');
      (revokedCertError as TypeError & { cause?: { code?: string } }).cause = { code: 'CERT_REVOKED' };
      throw revokedCertError;
    }) as typeof fetch;

    await expect(fetchAnalysis('revoked-cert.example')).rejects.toThrow('TLS certificate revoked: SiteSpecs API certificate has been revoked by its issuer');
  });

  test('failure: maps certificate signature failures CERT_SIGNATURE_FAILURE to deterministic message', async () => {
    global.fetch = mock(async () => {
      const signatureFailureError = new TypeError('fetch failed');
      (signatureFailureError as TypeError & { cause?: { code?: string } }).cause = { code: 'CERT_SIGNATURE_FAILURE' };
      throw signatureFailureError;
    }) as typeof fetch;

    await expect(fetchAnalysis('signature-failure-cert.example')).rejects.toThrow('TLS certificate signature failure: SiteSpecs API certificate signature validation failed');
  });

  test('failure: maps TLS protocol mismatches ERR_SSL_WRONG_VERSION_NUMBER to deterministic message', async () => {
    global.fetch = mock(async () => {
      const wrongVersionError = new TypeError('fetch failed');
      (wrongVersionError as TypeError & { cause?: { code?: string } }).cause = { code: 'ERR_SSL_WRONG_VERSION_NUMBER' };
      throw wrongVersionError;
    }) as typeof fetch;

    await expect(fetchAnalysis('tls-protocol-mismatch.example')).rejects.toThrow('TLS protocol mismatch: SiteSpecs API rejected the negotiated TLS version');
  });

  test('failure: maps issuer certificate retrieval failures UNABLE_TO_GET_ISSUER_CERT_LOCALLY to deterministic message', async () => {
    global.fetch = mock(async () => {
      const issuerCertError = new TypeError('fetch failed');
      (issuerCertError as TypeError & { cause?: { code?: string } }).cause = { code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' };
      throw issuerCertError;
    }) as typeof fetch;

    await expect(fetchAnalysis('issuer-chain-gap.example')).rejects.toThrow('TLS issuer validation failed: unable to retrieve SiteSpecs API issuer certificate locally');
  });

  test('failure: maps missing issuer certificate chain UNABLE_TO_GET_ISSUER_CERT to deterministic message', async () => {
    global.fetch = mock(async () => {
      const missingIssuerCertError = new TypeError('fetch failed');
      (missingIssuerCertError as TypeError & { cause?: { code?: string } }).cause = { code: 'UNABLE_TO_GET_ISSUER_CERT' };
      throw missingIssuerCertError;
    }) as typeof fetch;

    await expect(fetchAnalysis('issuer-cert-missing.example')).rejects.toThrow('TLS issuer certificate missing: unable to retrieve SiteSpecs API issuer certificate');
  });

  test('failure: maps certificate decrypt-signature failures UNABLE_TO_DECRYPT_CERT_SIGNATURE to deterministic message', async () => {
    global.fetch = mock(async () => {
      const decryptSignatureError = new TypeError('fetch failed');
      (decryptSignatureError as TypeError & { cause?: { code?: string } }).cause = { code: 'UNABLE_TO_DECRYPT_CERT_SIGNATURE' };
      throw decryptSignatureError;
    }) as typeof fetch;

    await expect(fetchAnalysis('decrypt-signature-cert.example')).rejects.toThrow('TLS certificate signature decode failure: unable to decrypt SiteSpecs API certificate signature');
  });

  test('failure: maps certificate chain overflow CERT_CHAIN_TOO_LONG to deterministic message', async () => {
    global.fetch = mock(async () => {
      const chainTooLongError = new TypeError('fetch failed');
      (chainTooLongError as TypeError & { cause?: { code?: string } }).cause = { code: 'CERT_CHAIN_TOO_LONG' };
      throw chainTooLongError;
    }) as typeof fetch;

    await expect(fetchAnalysis('chain-too-long-cert.example')).rejects.toThrow('TLS certificate chain too long: SiteSpecs API certificate chain exceeds validation depth');
  });

  test('failure: maps self-signed cert chain errors SELF_SIGNED_CERT_IN_CHAIN to deterministic message', async () => {
    global.fetch = mock(async () => {
      const selfSignedChainError = new TypeError('fetch failed');
      (selfSignedChainError as TypeError & { cause?: { code?: string } }).cause = { code: 'SELF_SIGNED_CERT_IN_CHAIN' };
      throw selfSignedChainError;
    }) as typeof fetch;

    await expect(fetchAnalysis('self-signed-chain.example')).rejects.toThrow('TLS trust chain failure: SiteSpecs API certificate chain includes a self-signed certificate');
  });

  test('failure: maps not-yet-valid certificate CERT_NOT_YET_VALID to deterministic message', async () => {
    global.fetch = mock(async () => {
      const notYetValidError = new TypeError('fetch failed');
      (notYetValidError as TypeError & { cause?: { code?: string } }).cause = { code: 'CERT_NOT_YET_VALID' };
      throw notYetValidError;
    }) as typeof fetch;

    await expect(fetchAnalysis('not-yet-valid-cert.example')).rejects.toThrow('TLS certificate not yet valid: SiteSpecs API certificate validity window has not started');
  });
});
