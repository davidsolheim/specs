import { describe, expect, test, vi } from "bun:test";

import {
  bootstrapAgentBrowser,
  findSystemBrowser,
  resolveBundledAgentBrowserBin,
} from "../scripts/bootstrap-agent-browser.mjs";

describe("agent-browser bootstrap", () => {
  test("skips bootstrap when explicitly opted out", () => {
    const result = bootstrapAgentBrowser({
      env: {
        SPECS_SKIP_AGENT_BROWSER_INSTALL: "1",
      },
    });

    expect(result).toEqual({
      status: "skipped",
      reason: "opt-out",
    });
  });

  test("skips bootstrap when a system browser is already available", () => {
    const spawnSync = vi.fn();

    const result = bootstrapAgentBrowser({
      platform: "darwin",
      existsSync: (candidate: string) => candidate.includes("Google Chrome.app"),
      spawnSync,
    });

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("system-browser-present");
    expect(spawnSync).not.toHaveBeenCalled();
  });

  test("runs agent-browser install when no system browser is present", () => {
    const spawnSync = vi.fn((command: string, args: string[]) => {
      if (command === "which") {
        return {
          status: 1,
          stdout: "",
          stderr: "",
        };
      }

      expect(command).toBe(process.execPath);
      expect(args).toEqual(["/tmp/agent-browser.js", "install"]);
      return {
        status: 0,
        stdout: "",
        stderr: "",
      };
    });

    const result = bootstrapAgentBrowser({
      platform: "linux",
      bundledBin: "/tmp/agent-browser.js",
      spawnSync,
    });

    expect(result).toMatchObject({
      status: "installed",
      bundledBin: "/tmp/agent-browser.js",
    });
  });

  test("findSystemBrowser prefers unix browser binaries discovered on PATH", () => {
    const browserPath = findSystemBrowser({
      platform: "linux",
      spawnSync: (command: string, args: string[]) => {
        expect(command).toBe("which");
        if (args[0] === "google-chrome") {
          return {
            status: 0,
            stdout: "/usr/bin/google-chrome\n",
            stderr: "",
          };
        }

        return {
          status: 1,
          stdout: "",
          stderr: "",
        };
      },
    });

    expect(browserPath).toBe("/usr/bin/google-chrome");
  });

  test("resolveBundledAgentBrowserBin returns undefined when the dependency is unavailable", () => {
    const requireWithMissingPackage = {
      resolve() {
        throw new Error("not found");
      },
    };

    expect(resolveBundledAgentBrowserBin({ require: requireWithMissingPackage })).toBeUndefined();
  });
});
