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
  const baselineMap = flattenJsonToLeafMap(baseline);
  const currentMap = flattenJsonToLeafMap(current);

  let changed = 0;
  let added = 0;
  let removed = 0;

  for (const [path, baselineValue] of baselineMap.entries()) {
    if (!currentMap.has(path)) {
      removed++;
      continue;
    }

    const currentValue = currentMap.get(path);
    if (currentValue !== baselineValue) changed++;
  }

  for (const path of currentMap.keys()) {
    if (!baselineMap.has(path)) added++;
  }

  return { changed, added, removed };
}
