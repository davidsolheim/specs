#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { read as readChangesetsConfig } from '@changesets/config';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const expectedPublishablePackages = ['@sitespecs/analyzer-core', '@sitespecs/contracts', '@sitespecs/specs'];
const packageRoots = ['packages'];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function collectWorkspacePackages() {
  return packageRoots.flatMap((segment) => {
    const root = path.join(workspaceRoot, segment);

    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name, 'package.json'))
      .filter((packageJsonPath) => existsSync(packageJsonPath))
      .map((packageJsonPath) => {
        const manifest = readJson(packageJsonPath);

        return {
          name: manifest.name,
          private: manifest.private === true,
          path: packageJsonPath,
        };
      });
  });
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatList(values) {
  return values.length === 0 ? '(none)' : values.join(', ');
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const changesetsConfig = readJson(path.join(workspaceRoot, '.changeset', 'config.json'));
  const workspacePackages = collectWorkspacePackages();
  const privatePackages = workspacePackages
    .filter((pkg) => pkg.private)
    .map((pkg) => pkg.name)
    .sort();
  const publishablePackages = workspacePackages
    .filter((pkg) => !pkg.private)
    .map((pkg) => pkg.name)
    .sort();
  ensure(
    JSON.stringify(publishablePackages) === JSON.stringify(expectedPublishablePackages),
    `Only ${formatList(expectedPublishablePackages)} may be publishable. Found: ${formatList(publishablePackages)}`
  );

  console.log('Validating Changesets configuration with the Changesets parser...');
  await readChangesetsConfig(workspaceRoot);

  console.log(`Release validation passed. Publishable package(s): ${formatList(publishablePackages)}`);
  console.log(`Private workspace package(s): ${formatList(privatePackages)}`);

  if (!isDryRun) {
    return;
  }

  execFileSync('node', ['./tools/release/publish-release.mjs', '--dry-run'], {
    cwd: workspaceRoot,
    stdio: 'inherit',
  });
}

try {
  await main();
} catch (error) {
  console.error('[release:validate]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
