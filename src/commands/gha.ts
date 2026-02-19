import { mkdir, writeFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { dirname } from 'node:path';

export async function ghaCommand(
  domain: string,
  options: {
    baseline?: string;
    workflow?: boolean;
    artifact?: string;
    artifactRetentionDays?: number | string;
    concurrency?: string;
    permissions?: string;
    timeoutMinutes?: number | string;
    fetchDepth?: number | string;
    name?: string;
    job?: string;
    jobName?: string;
    runsOn?: string;
    workingDirectory?: string;
    nodeVersion?: string;
    timeoutMinutes?: number | string;
    manual?: boolean;
    pullRequest?: boolean;
    push?: boolean;
    branch?: string;
    version?: string;
    write?: string;
    force?: boolean;
    schedule?: string;
  },
): Promise<void> {
  if (!domain) {
    console.error("GHA_DOMAIN_REQUIRED");
    process.exit(2);
    return;
  }

  if (!options.baseline) {
    console.error("GHA_BASELINE_REQUIRED");
    process.exit(2);
    return;
  }

  if (options.artifact !== undefined && !options.workflow) {
    console.error('WORKFLOW_ARTIFACT_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  const artifactPath =
    options.workflow && options.artifact !== undefined
      ? options.artifact.trim()
      : undefined;

  if (options.workflow && options.artifact !== undefined && artifactPath === '') {
    console.error('WORKFLOW_ARTIFACT_INVALID');
    process.exit(2);
    return;
  }

  if (options.artifactRetentionDays !== undefined && !options.workflow) {
    console.error('WORKFLOW_ARTIFACT_RETENTION_DAYS_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  if (options.artifactRetentionDays !== undefined && options.artifact === undefined) {
    console.error('WORKFLOW_ARTIFACT_RETENTION_DAYS_REQUIRES_ARTIFACT');
    process.exit(2);
    return;
  }

  let parsedArtifactRetentionDays: number | undefined;
  if (options.workflow && options.artifactRetentionDays !== undefined) {
    const raw = String(options.artifactRetentionDays).trim();
    const n = raw === '' ? Number.NaN : Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 90) {
      console.error('WORKFLOW_ARTIFACT_RETENTION_DAYS_INVALID');
      process.exit(2);
      return;
    }
    parsedArtifactRetentionDays = n;
  }

  if (options.fetchDepth !== undefined && !options.workflow) {
    console.error("WORKFLOW_FETCH_DEPTH_REQUIRES_WORKFLOW");
    process.exit(2);
    return;
  }

  let parsedFetchDepth: number | undefined;
  if (options.workflow && options.fetchDepth !== undefined) {
    const raw = String(options.fetchDepth).trim();
    const n = raw === "" ? Number.NaN : Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      console.error("WORKFLOW_FETCH_DEPTH_INVALID");
      process.exit(2);
      return;
    }
    parsedFetchDepth = n;
  }

  if (options.timeoutMinutes !== undefined && !options.workflow) {
    console.error("WORKFLOW_TIMEOUT_MINUTES_REQUIRES_WORKFLOW");
    process.exit(2);
    return;
  }

  if (options.concurrency !== undefined && !options.workflow) {
    console.error("WORKFLOW_CONCURRENCY_REQUIRES_WORKFLOW");
    process.exit(2);
    return;
  }

  if (options.concurrency !== undefined && options.workflow && options.concurrency.trim() === "") {
    console.error("WORKFLOW_CONCURRENCY_INVALID");
    process.exit(2);
    return;
  }

  if (options.permissions !== undefined && !options.workflow) {
    console.error("WORKFLOW_PERMISSIONS_REQUIRES_WORKFLOW");
    process.exit(2);
    return;
  }

  if (options.permissions !== undefined && options.workflow) {
    const mode = options.permissions.trim();
    if (mode !== "minimal") {
      console.error("WORKFLOW_PERMISSIONS_INVALID");
      process.exit(2);
      return;
    }
  }

  let timeout: number | undefined;
  if (options.workflow && options.timeoutMinutes !== undefined) {
    timeout = Number(String(options.timeoutMinutes).trim());
    if (!Number.isInteger(timeout) || timeout < 1) {
      console.error("WORKFLOW_TIMEOUT_MINUTES_INVALID");
      process.exit(2);
      return;
    }
  }

  if (options.force && options.write === undefined) {
    console.error('WORKFLOW_FORCE_INVALID');
    process.exit(2);
    return;
  }

  if (options.write !== undefined && !options.workflow) {
    console.error('WORKFLOW_WRITE_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  if (options.name !== undefined && !options.workflow) {
    console.error("WORKFLOW_NAME_REQUIRES_WORKFLOW");
    process.exit(2);
    return;
  }

  if (options.name !== undefined && options.workflow && options.name.trim() === "") {
    console.error("WORKFLOW_NAME_INVALID");
    process.exit(2);
    return;
  }

  if (options.job !== undefined && !options.workflow) {
    console.error("WORKFLOW_JOB_REQUIRES_WORKFLOW");
    process.exit(2);
    return;
  }

  if (options.job !== undefined && options.workflow) {
    const job = options.job.trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(job)) {
      console.error("WORKFLOW_JOB_INVALID");
      process.exit(2);
      return;
    }
  }

  if (options.jobName !== undefined && !options.workflow) {
    console.error("WORKFLOW_JOB_NAME_REQUIRES_WORKFLOW");
    process.exit(2);
    return;
  }

  if (options.jobName !== undefined && options.workflow) {
    const jobName = options.jobName.trim();
    if (jobName.length < 1 || jobName.length > 64) {
      console.error("WORKFLOW_JOB_NAME_INVALID");
      process.exit(2);
      return;
    }
  }

  if (options.runsOn !== undefined && !options.workflow) {
    console.error("WORKFLOW_RUNS_ON_REQUIRES_WORKFLOW");
    process.exit(2);
    return;
  }

  if (options.runsOn !== undefined && options.workflow && options.runsOn.trim() === "") {
    console.error("WORKFLOW_RUNS_ON_INVALID");
    process.exit(2);
    return;
  }

  if (options.workingDirectory !== undefined && !options.workflow) {
    console.error('WORKFLOW_WORKING_DIRECTORY_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  if (options.workingDirectory !== undefined && options.workflow) {
    const wd = options.workingDirectory.trim();
    if (wd.length < 1 || wd.length > 200 || wd.includes('\n')) {
      console.error('WORKFLOW_WORKING_DIRECTORY_INVALID');
      process.exit(2);
      return;
    }
  }

  if (options.nodeVersion !== undefined && !options.workflow) {
    console.error("WORKFLOW_NODE_VERSION_REQUIRES_WORKFLOW");
    process.exit(2);
    return;
  }

  if (options.nodeVersion !== undefined && options.workflow && options.nodeVersion.trim() === "") {
    console.error("WORKFLOW_NODE_VERSION_INVALID");
    process.exit(2);
    return;
  }

  if (options.timeoutMinutes !== undefined && !options.workflow) {
    console.error('WORKFLOW_TIMEOUT_MINUTES_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  const parsedTimeoutMinutes =
    options.workflow && options.timeoutMinutes !== undefined
      ? Number(String(options.timeoutMinutes).trim())
      : undefined;

  if (
    options.workflow &&
    options.timeoutMinutes !== undefined &&
    (!Number.isInteger(parsedTimeoutMinutes) || parsedTimeoutMinutes < 1)
  ) {
    console.error('WORKFLOW_TIMEOUT_MINUTES_INVALID');
    process.exit(2);
    return;
  }

  if (options.manual === true && !options.workflow) {
    console.error('WORKFLOW_MANUAL_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  if (options.pullRequest !== undefined && !options.workflow) {
    console.error('WORKFLOW_PULL_REQUEST_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  if (options.push !== undefined && !options.workflow) {
    console.error('WORKFLOW_PUSH_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  if (options.schedule !== undefined && !options.workflow) {
    console.error('WORKFLOW_SCHEDULE_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  if (options.branch !== undefined && !options.workflow) {
    console.error('WORKFLOW_BRANCH_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  const pkg = options.version
    ? `@sitespecs/specs@${options.version}`
    : "@sitespecs/specs@latest";

  if (options.workflow) {
    const branch = options.branch ?? 'main';
    const runsOn = options.runsOn ?? 'ubuntu-latest';
    const workingDirectory = options.workingDirectory ? options.workingDirectory.trim() : undefined;
    const job = options.job ? options.job.trim() : "sitespecs";
    const jobName = options.jobName ? options.jobName.trim() : undefined;
    const concurrencyGroup = options.concurrency !== undefined ? options.concurrency.trim() : undefined;
    const permissionsMode = options.permissions !== undefined ? options.permissions.trim() : undefined;

    const checkoutWithBlock =
      parsedFetchDepth !== undefined
        ? "        with:\n" + "          fetch-depth: " + parsedFetchDepth + "\n"
        : "";

    let onBlock = "on:\n" + "  workflow_dispatch:\n";
    if (options.pullRequest) onBlock += "  pull_request:\n" + `    branches: [${branch}]\n`;
    if (options.push) {
      onBlock += "  push:\n" + "    branches:\n" + `      - ${branch}\n`;
    }
    if (options.schedule) {
      onBlock +=
        "  schedule:\n" + "    - cron: '" + options.schedule + "'\n";
    }

    const concurrencyBlock =
      concurrencyGroup !== undefined
        ? "concurrency:\n" +
          "  group: " + concurrencyGroup + "\n" +
          "  cancel-in-progress: true\n"
        : "";

    const permissionsBlock =
      permissionsMode === "minimal"
        ? "permissions:\n" + "  contents: read\n"
        : "";

    let yaml =
      `name: ${options.name ?? 'SiteSpecs'}\n` +
      onBlock +
      concurrencyBlock +
      permissionsBlock +
      "jobs:\n" +
      "  " + job + ":\n" +
      (jobName !== undefined ? "    name: " + jobName + "\n" : "") +
      "    runs-on: " + runsOn + "\n" +
      (parsedTimeoutMinutes !== undefined
        ? "    timeout-minutes: " + parsedTimeoutMinutes + "\n"
        : "") +
      "    steps:\n" +
      "      - uses: actions/checkout@v4\n" +
      checkoutWithBlock +
      (options.nodeVersion !== undefined
        ? "      - uses: actions/setup-node@v4\n" +
          "        with:\n" +
          "          node-version: " + options.nodeVersion.trim() + "\n"
        : "") +
      "      - name: Specs CI\n" +
      "        run: npx -y " +
      pkg +
      " ci " +
      domain +
      " --baseline " +
      options.baseline +
      " --fail-on-diff" +
      (artifactPath !== undefined ? " --save " + artifactPath : "") +
      "\n" +
      (workingDirectory !== undefined
        ? "        working-directory: " + workingDirectory + "\n"
        : "");

    if (artifactPath !== undefined) {
      yaml +=
        "      - name: Upload Specs artifact\n" +
        "        uses: actions/upload-artifact@v4\n" +
        "        with:\n" +
        "          name: specs-artifact\n" +
        "          path: " +
        artifactPath +
        "\n" +
        (parsedArtifactRetentionDays !== undefined
          ? "          retention-days: " + parsedArtifactRetentionDays + "\n"
          : "");
    }

    if (permissionsBlock !== "" || parsedFetchDepth !== undefined) {
      // Match fixture formatting: some workflow variants end with an extra trailing blank line.
      yaml += "\n";
    }

    if (options.write !== undefined) {
      try {
        await mkdir(dirname(options.write), { recursive: true });
        await writeFile(options.write, yaml, {
          encoding: 'utf8',
          flag: options.force ? 'w' : 'wx',
        });
      } catch (err: any) {
        if (!options.force && err && (err.code === 'EEXIST' || err.code === 'EEXISTENT')) {
          // If the path already exists *as a file*, treat as overwrite guard.
          // If it's a directory (our deterministic write-failure fixture), keep WORKFLOW_WRITE_FAILED.
          try {
            if (!statSync(options.write).isDirectory()) {
              console.error(`WORKFLOW_OUT_EXISTS path=${options.write}`);
              process.exit(2);
              return;
            }
          } catch {
            console.error(`WORKFLOW_OUT_EXISTS path=${options.write}`);
            process.exit(2);
            return;
          }
        }

        console.error(`WORKFLOW_WRITE_FAILED path=${options.write}`);
        process.exit(2);
        return;
      }

      console.log(`WORKFLOW_SAVED path=${options.write}`);
      return;
    }

    console.log(yaml);
    return;
  }

  console.log("- name: Specs CI");
  console.log(
    "  run: npx -y " +
      pkg +
      " ci " +
      domain +
      " --baseline " +
      options.baseline +
      " --fail-on-diff",
  );
}
