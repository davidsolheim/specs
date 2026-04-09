import { bootstrapAgentBrowser } from "./bootstrap-agent-browser.mjs";

const result = bootstrapAgentBrowser();

if (result.status === "skipped") {
  if (result.reason === "opt-out") {
    console.log("[sitespecs] Skipping agent-browser bootstrap because SPECS_SKIP_AGENT_BROWSER_INSTALL=1.");
  }
} else if (result.status === "installed") {
  console.log("[sitespecs] agent-browser runtime bootstrap completed.");
} else if (result.status === "failed") {
  console.warn("[sitespecs] agent-browser runtime bootstrap did not complete automatically.");
  if (result.message) {
    console.warn(result.message);
  }
  if (result.hint) {
    console.warn(result.hint);
  }
}
