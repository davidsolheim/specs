import { lookup, resolveCname } from "node:dns/promises";
import { connect as tlsConnect } from "node:tls";

import type { AnalysisDns, AnalysisTls } from "@sitespecs/contracts";

function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

function formatCertIdentity(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value as Record<string, string>).filter(([, item]) => Boolean(item));
  if (entries.length === 0) return undefined;
  return entries.map(([key, item]) => `${key}=${item}`).join(", ");
}

export async function analyzeDns(targetUrl: string): Promise<AnalysisDns | undefined> {
  const hostname = new URL(targetUrl).hostname;

  const [addressesResult, cnameResult] = await Promise.allSettled([
    lookup(hostname, { all: true }),
    resolveCname(hostname),
  ]);

  const addresses =
    addressesResult.status === "fulfilled"
      ? Array.from(new Set(addressesResult.value.map((entry) => entry.address)))
      : [];

  const cname = cnameResult.status === "fulfilled" ? cnameResult.value : [];

  if (addresses.length === 0 && cname.length === 0) {
    return undefined;
  }

  return {
    ...(addresses.length > 0 ? { addresses } : {}),
    ...(cname.length > 0 ? { cname } : {}),
  };
}

export async function analyzeTls(targetUrl: string): Promise<AnalysisTls | undefined> {
  const url = new URL(targetUrl);
  if (url.protocol !== "https:") {
    return undefined;
  }

  const port = url.port ? Number(url.port) : 443;
  const hostname = url.hostname;

  return new Promise<AnalysisTls | undefined>((resolve) => {
    let settled = false;
    const finish = (value: AnalysisTls | undefined) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const socket = tlsConnect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
      },
      () => {
        try {
          const peer = socket.getPeerCertificate(true);
          const validFrom = normalizeDate(peer?.valid_from);
          const validTo = normalizeDate(peer?.valid_to);
          const validToMs = validTo ? Date.parse(validTo) : Number.NaN;
          const daysRemaining =
            Number.isNaN(validToMs) ? undefined : Math.max(0, Math.ceil((validToMs - Date.now()) / 86_400_000));

          finish({
            authorized: socket.authorized,
            authorizationError:
              typeof socket.authorizationError === "string"
                ? socket.authorizationError
                : socket.authorizationError?.message || undefined,
            protocol: socket.getProtocol() || undefined,
            issuer: formatCertIdentity(peer?.issuer),
            subject: formatCertIdentity(peer?.subject),
            validFrom,
            validTo,
            ...(daysRemaining !== undefined ? { daysRemaining } : {}),
          });
        } catch {
          finish(undefined);
        } finally {
          socket.end();
        }
      },
    );

    socket.setTimeout(5_000, () => {
      socket.destroy();
      finish(undefined);
    });

    socket.once("error", () => {
      finish(undefined);
    });

    socket.once("close", () => {
      finish(undefined);
    });
  });
}
