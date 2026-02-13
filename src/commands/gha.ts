import { mkdir, writeFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { dirname } from 'node:path';

export async function ghaCommand(
  domain: string,
  options: {
    baseline?: string;
    workflow?: boolean;
    name?: string;
    runsOn?: string;
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

    let onBlock = "on:\n" + "  workflow_dispatch:\n";
    if (options.pullRequest) onBlock += "  pull_request:\n" + `    branches: [${branch}]\n`;
    if (options.push) {
      onBlock += "  push:\n" + "    branches:\n" + `      - ${branch}\n`;
    }
    if (options.schedule) {
      onBlock +=
        "  schedule:\n" + "    - cron: '" + options.schedule + "'\n";
    }

    const yaml =
      `name: ${options.name ?? 'SiteSpecs'}\n` +
      onBlock +
      "jobs:\n" +
      "  sitespecs:\n" +
      "    runs-on: " + runsOn + "\n" +
      "    steps:\n" +
      "      - uses: actions/checkout@v4\n" +
      "      - name: Specs CI\n" +
      "        run: npx -y " +
      pkg +
      " ci " +
      domain +
      " --baseline " +
      options.baseline +
      "\n";

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
      options.baseline,
  );
}
