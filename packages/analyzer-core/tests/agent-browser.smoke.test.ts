import { describe, expect, test } from "bun:test";

import { analyzeWithAgentBrowser } from "../src/agent-browser";

const shouldRun = process.env.SPECS_RUN_AGENT_BROWSER_SMOKE === "1";

describe.skipIf(!shouldRun)("agent-browser smoke", () => {
  test("captures a rendered snapshot for example.com with the real CLI", async () => {
    const snapshot = await analyzeWithAgentBrowser("https://example.com");

    expect(snapshot.finalUrl).toContain("example.com");
    expect(snapshot.html.toLowerCase()).toContain("<html");
    expect(snapshot.title).toBeTruthy();
  });
});
