#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isDryRun = process.argv.includes('--dry-run');
const publishablePackages = [
  {
    directory: 'packages/contracts',
    workspace: '@sitespecs/contracts',
  },
  {
    directory: 'packages/analyzer-core',
    workspace: '@sitespecs/analyzer-core',
  },
  {
    directory: 'packages/specs-cli',
    workspace: '@sitespecs/specs',
    smokeTest: true,
  },
].map((pkg) => {
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, pkg.directory, 'package.json'), 'utf8'));

  return {
    ...pkg,
    manifest,
    packageName: String(manifest.name),
    version: String(manifest.version),
  };
});

function resolveDistTag(packageVersion) {
  const prereleaseMatch = packageVersion.match(/-([0-9A-Za-z-]+)(?:[.-]|$)/);
  return prereleaseMatch?.[1] ?? 'latest';
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    ...options,
  });
}

function preparePublishArtifacts() {
  for (const workspace of publishablePackages.map((pkg) => pkg.workspace)) {
    execFileSync('npm', ['run', 'build', '--workspace', workspace], {
      cwd: workspaceRoot,
      stdio: 'inherit',
    });
  }
}

function isPublishedVersion(packageName, version) {
  try {
    const output = execFileSync('npm', ['view', `${packageName}@${version}`, 'version', '--json'], {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .toString()
      .trim();

    if (!output) {
      return false;
    }

    const parsed = JSON.parse(output);
    return parsed === version;
  } catch {
    return false;
  }
}

function packWorkspace(directory, packDestination) {
  const output = execFileSync('npm', ['pack', `./${directory}`, '--pack-destination', packDestination], {
    cwd: workspaceRoot,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .toString()
    .trim()
    .split('\n')
    .at(-1);

  if (!output) {
    throw new Error(`Failed to pack ${directory}`);
  }

  return path.join(packDestination, output);
}

function smokeTestSpecs(specsTarball, expectedVersion) {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'specs-release-'));
  const globalPrefix = path.join(tempRoot, 'global');

  try {
    run('npm', ['install', '-g', '--prefix', globalPrefix, specsTarball]);

    const specsBin =
      process.platform === 'win32'
        ? path.join(globalPrefix, 'specs.cmd')
        : path.join(globalPrefix, 'bin', 'specs');
    const npmRoot = execFileSync('npm', ['root', '-g', '--prefix', globalPrefix], {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
      .toString()
      .trim();
    const installedPackageRoot = path.join(npmRoot, '@sitespecs', 'specs');
    const bundledAgentBrowser =
      process.platform === 'win32'
        ? path.join(installedPackageRoot, 'node_modules', '.bin', 'agent-browser.cmd')
        : path.join(installedPackageRoot, 'node_modules', '.bin', 'agent-browser');

    if (!existsSync(bundledAgentBrowser)) {
      throw new Error('Bundled agent-browser binary was not installed with @sitespecs/specs');
    }

    const versionOutput = execFileSync(specsBin, ['--version'], {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
      .toString()
      .trim();

    if (versionOutput !== expectedVersion) {
      throw new Error(`Expected specs version ${expectedVersion}, received ${versionOutput}`);
    }

    execFileSync(bundledAgentBrowser, ['--version'], {
      cwd: workspaceRoot,
      stdio: 'inherit',
    });

    const restrictedPath = process.platform === 'win32'
      ? `${path.dirname(specsBin)};${path.dirname(process.execPath)}`
      : `${path.dirname(specsBin)}:${path.dirname(process.execPath)}:/usr/bin:/bin`;
    const summaryOutput = execFileSync(specsBin, ['example.com', '--summary-json'], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        AGENT_BROWSER_BIN: 'missing-agent-browser',
        PATH: restrictedPath,
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    })
      .toString()
      .trim();

    const parsed = JSON.parse(summaryOutput);
    if (parsed.ok !== true) {
      throw new Error(`Smoke test returned a non-success summary payload: ${summaryOutput}`);
    }
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }
}

if (isDryRun) {
  preparePublishArtifacts();
  const packRoot = mkdtempSync(path.join(tmpdir(), 'specs-pack-'));

  try {
    for (const pkg of publishablePackages) {
      console.log(`Packing ${pkg.packageName}@${pkg.version} for publish validation...`);
      const tarball = packWorkspace(pkg.directory, packRoot);

      if (pkg.smokeTest) {
        smokeTestSpecs(tarball, pkg.version);
      }
    }
  } finally {
    rmSync(packRoot, { force: true, recursive: true });
  }
} else {
  preparePublishArtifacts();

  for (const pkg of publishablePackages) {
    const distTag = resolveDistTag(pkg.version);

    if (isPublishedVersion(pkg.packageName, pkg.version)) {
      console.log(`Skipping npm publish because ${pkg.packageName}@${pkg.version} is already published.`);
      continue;
    }

    console.log(`Publishing ${pkg.packageName}@${pkg.version} with npm dist-tag "${distTag}"...`);
    run('npm', ['publish', `./${pkg.directory}`, '--access', 'public', '--tag', distTag]);
  }
}
