type Primitive = string | number | boolean | null;

type LeafValue = Primitive;

function isLeaf(value: unknown): value is LeafValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function flattenJsonToLeafMap(input: unknown): Map<string, LeafValue> {
  const out = new Map<string, LeafValue>();

  const visit = (value: unknown, path: string) => {
    if (isLeaf(value)) {
      if (path.length > 0) out.set(path, value);
      return;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const nextPath = path ? `${path}[${i}]` : `[${i}]`;
        visit(value[i], nextPath);
      }
      return;
    }

    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj).sort()) {
        const nextPath = path ? `${path}.${key}` : key;
        visit(obj[key], nextPath);
      }
      return;
    }

    // Non-JSON-ish leaf (undefined, bigint, symbol, function, etc.).
    // Treat as leaf via stringification to keep diff deterministic.
    if (path.length > 0) out.set(path, String(value) as unknown as LeafValue);
  };

  visit(input, '');
  return out;
}

export function computeJsonDriftCounts(baseline: unknown, current: unknown): {
  changed: number;
  added: number;
  removed: number;
} {
  const details = computeJsonDriftDetails(baseline, current);
  return { changed: details.changed, added: details.added, removed: details.removed };
}

export function computeJsonDriftDetails(baseline: unknown, current: unknown): {
  changed: number;
  added: number;
  removed: number;
  changedPaths: string[];
  addedPaths: string[];
  removedPaths: string[];
} {
  const baselineMap = flattenJsonToLeafMap(baseline);
  const currentMap = flattenJsonToLeafMap(current);

  const changedPaths: string[] = [];
  const addedPaths: string[] = [];
  const removedPaths: string[] = [];

  for (const [path, baselineValue] of baselineMap.entries()) {
    if (!currentMap.has(path)) {
      removedPaths.push(path);
      continue;
    }

    const currentValue = currentMap.get(path);
    if (currentValue !== baselineValue) changedPaths.push(path);
  }

  for (const path of currentMap.keys()) {
    if (!baselineMap.has(path)) addedPaths.push(path);
  }

  changedPaths.sort((a, b) => a.localeCompare(b));
  addedPaths.sort((a, b) => a.localeCompare(b));
  removedPaths.sort((a, b) => a.localeCompare(b));

  return {
    changed: changedPaths.length,
    added: addedPaths.length,
    removed: removedPaths.length,
    changedPaths,
    addedPaths,
    removedPaths,
  };
}
