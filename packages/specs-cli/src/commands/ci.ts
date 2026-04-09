import { readFile, writeFile } from 'node:fs/promises';
import type { AnalysisResponse } from '../lib/api.js';
import { resolveAnalysis } from '../lib/analysis.js';
import { classifyCommandFailure } from '../lib/failure-classification.js';
import { computeJsonDriftCounts } from '../lib/json-diff.js';

type CiOptions = {
  baseline?: string;
  mode?: string;
  enrich?: boolean;
  save?: string;
  saveFlagPresent?: boolean;
  failOnDiff?: boolean;
};

type CiSummaryJsonOutput = {
  ok: boolean;
  domain: string;
  drift_changed: number;
  drift_added: number;
  drift_removed: number;
  execution_mode?: AnalysisResponse["execution"] extends infer T
    ? T extends { mode?: infer Mode }
      ? Mode
      : never
    : never;
  execution_engine?: AnalysisResponse["execution"] extends infer T
    ? T extends { engine?: infer Engine }
      ? Engine
      : never
    : never;
  degraded?: boolean;
  enrichment_status?: AnalysisResponse["execution"] extends infer T
    ? T extends { enrichmentStatus?: infer Status }
      ? Status
      : never
    : never;
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

function executionSummaryFields(data: AnalysisResponse) {
  return {
    ...(data.execution?.mode ? { execution_mode: data.execution.mode } : {}),
    ...(data.execution?.engine ? { execution_engine: data.execution.engine } : {}),
    ...(data.execution?.degraded !== undefined ? { degraded: data.execution.degraded } : {}),
    ...(data.execution?.enrichmentStatus ? { enrichment_status: data.execution.enrichmentStatus } : {}),
  };
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

  if (options.enrich && options.mode === 'cloud') {
    console.error('CI_ENRICH_MODE_CONFLICT');
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
    data = await resolveAnalysis(domain, { mode: options.mode, enrich: options.enrich });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({
      ok: false,
      domain,
      drift_changed: 0,
      drift_added: 0,
      drift_removed: 0,
      exit: 1,
      error: classifyCommandFailure(message),
    });
    process.exit(1);
    return;
  }

  const { changed, added, removed } = computeJsonDriftCounts(baselineJson, data);
  const drift = changed + added + removed;
  const hasDrift = drift > 0;
  const failOnDiff = options.failOnDiff === true;
  const driftExit = hasDrift && failOnDiff ? 1 : 0;

  const out: CiSummaryJsonOutput = {
    ok: !hasDrift,
    domain,
    drift_changed: changed,
    drift_added: added,
    drift_removed: removed,
    ...executionSummaryFields(data as AnalysisResponse),
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
