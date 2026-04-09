# CLI Transport/TLS Error Contract

This table defines the deterministic `specs` CLI transport and TLS error mapping contract.

Scope:
- Source: `src/lib/api.ts`
- Enforcement: `tests/api-fetch-analysis.test.ts`
- CI gate: `bun run test:webhook-contract` via `.github/workflows/webhook-contract.yml`

If messages drift, fixture tests must fail.

## Deterministic Contract Table

| Error code / class | Deterministic CLI message | Operator remediation |
| --- | --- | --- |
| `AbortError` | `Request timed out: SiteSpecs API did not respond in time` | Retry once; verify API latency/incident status; increase timeout only if justified. |
| generic `TypeError` (no mapped `cause.code`) | `Network error: unable to reach SiteSpecs API` | Check local connectivity, DNS resolver health, and outbound firewall/proxy rules. |
| `ENOTFOUND` | `DNS error: unable to resolve SiteSpecs API host` | Validate `SPECS_API_URL` host spelling; check DNS resolver and record propagation. |
| `ECONNRESET` | `Connection reset: SiteSpecs API connection was interrupted` | Retry; inspect API edge/load balancer resets; check TLS middleboxes/proxies. |
| `EHOSTUNREACH` | `Route unreachable: unable to reach SiteSpecs API network` | Verify route/VPN/NAT path and network ACLs; test from another network region. |
| `ECONNREFUSED` | `Connection refused: SiteSpecs API is not accepting connections` | Confirm API process/listener health; verify port exposure and ingress policy. |
| `CERT_HAS_EXPIRED` | `TLS certificate expired: SiteSpecs API certificate is no longer valid` | Rotate/renew server certificate and reload terminator. |
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | `TLS verification failed: unable to verify SiteSpecs API certificate chain` | Install full chain (leaf + intermediates) and verify trust chain presentation. |
| `DEPTH_ZERO_SELF_SIGNED_CERT` | `TLS trust failure: SiteSpecs API returned a self-signed certificate` | Replace self-signed cert with CA-issued cert (or trusted private CA where appropriate). |
| `ERR_TLS_CERT_ALTNAME_INVALID` | `TLS hostname mismatch: SiteSpecs API certificate does not match the requested host` | Reissue cert with correct SAN/CN for API hostname; verify `SPECS_API_URL`. |
| `CERT_REVOKED` | `TLS certificate revoked: SiteSpecs API certificate has been revoked by its issuer` | Replace revoked certificate immediately and investigate key compromise/rotation path. |
| `CERT_SIGNATURE_FAILURE` | `TLS certificate signature failure: SiteSpecs API certificate signature validation failed` | Reissue valid certificate from trusted CA; inspect chain corruption/mis-issuance. |
| `ERR_SSL_WRONG_VERSION_NUMBER` | `TLS protocol mismatch: SiteSpecs API rejected the negotiated TLS version` | Align TLS versions between client path and terminator; disable plaintext-on-TLS port mixups. |
| `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` | `TLS issuer validation failed: unable to retrieve SiteSpecs API issuer certificate locally` | Provide missing intermediates and validate local trust store / CA bundle freshness. |
| `UNABLE_TO_GET_ISSUER_CERT` | `TLS issuer certificate missing: unable to retrieve SiteSpecs API issuer certificate` | Fix server chain to include correct issuing certificates/intermediates. |
| `UNABLE_TO_DECRYPT_CERT_SIGNATURE` | `TLS certificate signature decode failure: unable to decrypt SiteSpecs API certificate signature` | Replace malformed/corrupted cert; reissue from CA and verify PEM integrity. |
| `CERT_CHAIN_TOO_LONG` | `TLS certificate chain too long: SiteSpecs API certificate chain exceeds validation depth` | Shorten/repair certificate chain; remove extraneous intermediates. |
| `SELF_SIGNED_CERT_IN_CHAIN` | `TLS trust chain failure: SiteSpecs API certificate chain includes a self-signed certificate` | Remove untrusted self-signed element; serve proper CA chain. |
| `CERT_NOT_YET_VALID` | `TLS certificate not yet valid: SiteSpecs API certificate validity window has not started` | Correct system/server clock and deploy cert with active validity window. |

## Non-transport API contract notes

- `404` maps to `Domain not found: <domain>`.
- Other non-2xx responses map to `API error: <status> <statusText>`.

These behaviors are also enforced in `tests/api-fetch-analysis.test.ts`.
