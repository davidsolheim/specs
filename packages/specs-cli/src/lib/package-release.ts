export function resolvePackageDistTag(packageVersion: string): string {
  const prereleaseMatch = packageVersion.match(/-([0-9A-Za-z-]+)(?:[.-]|$)/);
  return prereleaseMatch?.[1] ?? 'latest';
}

export function resolveDefaultPackageSpecifier(
  packageVersion: string,
  packageName = '@sitespecs/specs',
): string {
  return `${packageName}@${resolvePackageDistTag(packageVersion)}`;
}
