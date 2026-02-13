export async function ghaCommand(
  domain: string,
  options: { baseline?: string },
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

  console.log("- name: Specs CI");
  console.log(
    "  run: npx -y @sitespecs/specs@latest ci " +
      domain +
      " --baseline " +
      options.baseline,
  );
}

