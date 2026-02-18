import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchAnalysis } from '../lib/api';

function classifyFetchError(error: unknown): 'rate_limited' | 'upstream_unavailable' | 'api_error' {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('Rate limited:')) return 'rate_limited';

  if (
    /^API error: (500|502|503|504)\b/.test(message) ||
    message.startsWith('DNS temporarily unavailable:') ||
    message.startsWith('DNS error:') ||
    message.startsWith('Connection reset:') ||
    message.startsWith('Connection timed out:') ||
    message.startsWith('Request timed out:') ||
    message.startsWith('Route unreachable:') ||
    message.startsWith('Connection refused:') ||
    message === 'Network error: unable to reach SiteSpecs API'
  ) {
    return 'upstream_unavailable';
  }

  return 'api_error';
}

function exitFetchFailure(error: unknown) {
  console.error(`BASELINE_FETCH_FAILED error=${classifyFetchError(error)}`);
  process.exit(1);
}

export async function baselineCommand(
  domain: string,
  options: { out?: string; profile?: string; force?: boolean; stdout?: boolean }
) {
  if (!domain) {
    process.exit(2);
    return;
  }

  // Baseline subcommand does not accept profiles (treat as usage error).
  if (options.profile !== undefined) {
    process.exit(2);
    return;
  }

  // Normalize domain exactly like analyze.
  const normalizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

  // stdout mode: print a single raw JSON line and do not touch the filesystem.
  if (options.stdout) {
    if (options.out !== undefined) {
      console.error('BASELINE_OUTPUT_CONFLICT');
      process.exit(2);
      return;
    }

    if (options.force) {
      console.error('BASELINE_FORCE_INVALID');
      process.exit(2);
      return;
    }

    let data: unknown;
    try {
      data = await fetchAnalysis(normalizedDomain);
    } catch (error) {
      exitFetchFailure(error);
      return;
    }

    console.log(JSON.stringify(data));
    return;
  }

  // file mode: require --out.
  if (!options.out || options.out.trim() === '') {
    process.exit(2);
    return;
  }

  // Refuse to overwrite an existing baseline file unless --force is provided.
  try {
    await stat(options.out);
    if (!options.force) {
      console.error(`BASELINE_OUT_EXISTS path=${options.out}`);
      process.exit(2);
      return;
    }
  } catch {
    // does not exist (or not stat'able) → proceed to write
  }

  let data: unknown;
  try {
    data = await fetchAnalysis(normalizedDomain);
  } catch (error) {
    exitFetchFailure(error);
    return;
  }

  try {
    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(options.out, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    process.exit(2);
    return;
  }

  console.log(`BASELINE_SAVED path=${options.out}`);
}
