export type CommandFailureCode =
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'local_runtime_dependency_error'
  | 'api_error';

function isLocalRuntimeDependencyFailure(message: string): boolean {
  const normalized = message.toLowerCase();

  if (!normalized.includes('local analysis failed:')) {
    return false;
  }

  return (
    normalized.includes('local linux browser dependencies are missing') ||
    normalized.includes('browser runtime is not ready') ||
    normalized.includes('error while loading shared libraries') ||
    normalized.includes('cannot open shared object file') ||
    normalized.includes('chrome exited early') ||
    normalized.includes('libnspr4.so') ||
    normalized.includes('run `agent-browser install`') ||
    normalized.includes('install --with-deps')
  );
}

export function classifyCommandFailure(message: string): CommandFailureCode {
  if (message.startsWith('Rate limited:')) return 'rate_limited';

  if (isLocalRuntimeDependencyFailure(message)) {
    return 'local_runtime_dependency_error';
  }

  if (
    /^API error: (408|500|502|503|504|520|521|522|523|524|525|526|527|528|530)\b/.test(message) ||
    message.startsWith('DNS temporarily unavailable:') ||
    message.startsWith('DNS error:') ||
    message.startsWith('Connection reset:') ||
    message.startsWith('Connection timed out:') ||
    message.startsWith('Request timed out:') ||
    message.startsWith('Route unreachable:') ||
    message.startsWith('Connection refused:') ||
    message === 'Network error: unable to reach SiteSpecs API' ||
    message.startsWith('Cloud analysis timed out:')
  ) {
    return 'upstream_unavailable';
  }

  return 'api_error';
}
