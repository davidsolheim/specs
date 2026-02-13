import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function ghaCommand(
  domain: string,
  options: { baseline?: string; workflow?: boolean; version?: string; write?: string },
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

  if (options.write !== undefined && !options.workflow) {
    console.error('WORKFLOW_WRITE_REQUIRES_WORKFLOW');
    process.exit(2);
    return;
  }

  const pkg = options.version
    ? `@sitespecs/specs@${options.version}`
    : "@sitespecs/specs@latest";

  if (options.workflow) {
    const yaml =
      "name: SiteSpecs\n" +
      "on: [push, pull_request]\n" +
      "jobs:\n" +
      "  sitespecs:\n" +
      "    runs-on: ubuntu-latest\n" +
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
        await writeFile(options.write, yaml, 'utf8');
      } catch {
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
