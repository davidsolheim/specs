export async function ghaCommand(
  domain: string,
  options: { baseline?: string; workflow?: boolean },
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

  if (options.workflow) {
    console.log(
      "name: SiteSpecs\n" +
        "on: [push, pull_request]\n" +
        "jobs:\n" +
        "  sitespecs:\n" +
        "    runs-on: ubuntu-latest\n" +
        "    steps:\n" +
        "      - uses: actions/checkout@v4\n" +
        "      - name: Specs CI\n" +
        "        run: npx -y @sitespecs/specs@latest ci " +
        domain +
        " --baseline " +
        options.baseline +
        "\n",
    );
    return;
  }

  console.log("- name: Specs CI");
  console.log(
    "  run: npx -y @sitespecs/specs@latest ci " +
      domain +
      " --baseline " +
      options.baseline,
  );
}
