import { readFile, writeFile } from 'node:fs/promises';
import { fetchAnalysis } from '../lib/api';
import { computeJsonDriftCounts } from '../lib/json-diff';

type CiOptions = {
  baseline?: string;
  save?: string;
  saveFlagPresent?: boolean;
};

type CiSummaryJsonOutput = {
  ok: boolean;
  domain: string;
  drift_changed: number;
  drift_added: number;
  drift_removed: number;
  exit: number;
  error: string | null;
};

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as any;
    if (typeof anyErr.code === 'string' && anyErr.code.length > 0) return anyErr.code;
    if (typeof anyErr.message === 'string' && anyErr.message.length > 0) return anyErr.message;
  }
  return String(err);
}

export async function ciCommand(domain: string, options: CiOptions) {
  if (!domain || !options.baseline) {
    console.error('CI_BASELINE_REQUIRED');
    process.exit(2);
    return;
  }

  if (options.saveFlagPresent && (!options.save || options.save.trim() === '')) {
    console.error('CI_SAVE_INVALID');
    process.exit(2);
    return;
  }

  const emit = (out: CiSummaryJsonOutput) => {
    // Must be exactly one line on stdout with no additional noise.
    console.log(JSON.stringify(out));
  };

  let baselineJson: unknown;
  try {
    const raw = await readFile(options.baseline, 'utf8');
    baselineJson = JSON.parse(raw);
  } catch {
    console.error('CI_BASELINE_REQUIRED');
    process.exit(2);
    return;
  }

  let data: unknown;
  try {
    data = await fetchAnalysis(domain);
  } catch (err) {
    const isRateLimited = err instanceof Error && err.message.startsWith('Rate limited:');
    emit({
      ok: false,
      domain,
      drift_changed: 0,
      drift_added: 0,
      drift_removed: 0,
      exit: 1,
      error: isRateLimited ? 'rate_limited' : 'api_error',
    });
    process.exit(1);
    return;
  }

  const { changed, added, removed } = computeJsonDriftCounts(baselineJson, data);
  const drift = changed + added + removed;
  const driftExit = drift > 0 ? 1 : 0;

  const out: CiSummaryJsonOutput = {
    ok: driftExit === 0,
    domain,
    drift_changed: changed,
    drift_added: added,
    drift_removed: removed,
    exit: driftExit,
    error: null,
  };

  // Always print stdout deterministically first.
  emit(out);

  if (options.save) {
    try {
      await writeFile(options.save, JSON.stringify(data), 'utf8');
    } catch (err) {
      const message = extractErrorMessage(err);
      console.error(`CI_SAVE_FAILED path=${options.save} error=${message}`);
      process.exit(2);
      return;
    }
  }

  if (out.exit !== 0) process.exit(out.exit);
}

