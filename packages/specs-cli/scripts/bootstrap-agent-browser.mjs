import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const SYSTEM_BROWSER_CANDIDATES = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  win32: (env) =>
    [
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Chromium", "Application", "chrome.exe"),
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
      env["PROGRAMFILES(X86)"] &&
        path.join(env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
      env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Chromium", "Application", "chrome.exe"),
      env["PROGRAMFILES(X86)"] &&
        path.join(env["PROGRAMFILES(X86)"], "Chromium", "Application", "chrome.exe"),
      env.PROGRAMFILES && path.join(env.PROGRAMFILES, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      env["PROGRAMFILES(X86)"] &&
        path.join(env["PROGRAMFILES(X86)"], "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    ].filter(Boolean),
};

function findUnixBrowserBinary(commandNames, options) {
  const runner = options.spawnSync ?? spawnSync;

  for (const commandName of commandNames) {
    const result = runner("which", [commandName], {
      encoding: "utf8",
      stdio: "pipe",
    });

    if (result.status === 0) {
      const browserPath = result.stdout?.trim();
      if (browserPath) {
        return browserPath;
      }
    }
  }

  return undefined;
}

export function findSystemBrowser(options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const exists = options.existsSync ?? existsSync;

  if (platform === "darwin" || platform === "win32") {
    const candidates =
      platform === "darwin" ? SYSTEM_BROWSER_CANDIDATES.darwin : SYSTEM_BROWSER_CANDIDATES.win32(env);

    for (const candidate of candidates) {
      if (exists(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  if (platform === "linux") {
    return findUnixBrowserBinary(
      [
        "google-chrome",
        "google-chrome-stable",
        "chromium-browser",
        "chromium",
        "brave-browser",
      ],
      options,
    );
  }

  return undefined;
}

export function resolveBundledAgentBrowserBin(options = {}) {
  if (options.bundledBin) {
    return options.bundledBin;
  }

  const requireFn = options.require ?? createRequire(import.meta.url);

  try {
    const manifestPath = requireFn.resolve("agent-browser/package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const binEntry =
      typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.["agent-browser"];

    if (!binEntry) {
      return undefined;
    }

    const resolvedBin = path.resolve(path.dirname(manifestPath), binEntry);
    return (options.existsSync ?? existsSync)(resolvedBin) ? resolvedBin : undefined;
  } catch {
    return undefined;
  }
}

export function bootstrapAgentBrowser(options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;

  if (env.SPECS_SKIP_AGENT_BROWSER_INSTALL === "1") {
    return {
      status: "skipped",
      reason: "opt-out",
    };
  }

  const browserPath = findSystemBrowser(options);
  if (browserPath) {
    return {
      status: "skipped",
      reason: "system-browser-present",
      browserPath,
    };
  }

  const bundledBin = resolveBundledAgentBrowserBin(options);
  if (!bundledBin) {
    return {
      status: "skipped",
      reason: "bundled-agent-browser-missing",
    };
  }

  const runner = options.spawnSync ?? spawnSync;
  const result = runner(options.nodePath ?? process.execPath, [bundledBin, "install"], {
    env,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.error) {
    return {
      status: "failed",
      reason: "spawn-error",
      bundledBin,
      message: result.error.message,
    };
  }

  if (result.status === 0) {
    return {
      status: "installed",
      bundledBin,
    };
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  return {
    status: "failed",
    reason: "install-exit-nonzero",
    bundledBin,
    message: output || `agent-browser install exited with status ${result.status ?? "unknown"}`,
    hint:
      platform === "linux"
        ? "If Linux system dependencies are missing, run `agent-browser install --with-deps` manually."
        : undefined,
  };
}
