import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchAnalysis } from '../lib/api';

export async function baselineCommand(
  domain: string,
  options: { out?: string; profile?: string }
) {
  if (!domain || !options.out || options.out.trim() === '') {
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

  let data: unknown;
  try {
    data = await fetchAnalysis(normalizedDomain);
  } catch {
    process.exit(1);
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

