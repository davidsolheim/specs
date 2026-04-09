import process from "node:process";

import { analyzeUrl } from "../src/analyze-url.js";
import {
  TECH_BENCHMARK_CASES,
  type TechBenchmarkCase,
} from "../src/tech-benchmark.js";

type OutputFormat = "json" | "markdown";

type BenchmarkCaseResult = {
  detectedTech: string[];
  domain: string;
  error?: string;
  executionEngine?: string;
  forbiddenHits: string[];
  framework?: string;
  host?: string;
  missingRequired: string[];
  notes?: string;
  optionalMatched: string[];
  repoUrl: string;
  status: "error" | "offline" | "online";
  truthSource: string[];
  unstable: boolean;
};

type ProviderCoverageRow = {
  detectedOn: string[];
  expectedOn: string[];
  missingOn: string[];
  technology: string;
};

type BenchmarkReport = {
  cases: BenchmarkCaseResult[];
  generatedAt: string;
  providerCoverage: ProviderCoverageRow[];
  summary: {
    failingStableCases: number;
    totalCases: number;
    unstableCases: number;
  };
};

function parseArgs(argv: string[]): { domains: Set<string>; format: OutputFormat } {
  const domains = new Set<string>();
  let format: OutputFormat = "markdown";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--format" && argv[index + 1]) {
      format = argv[index + 1] === "json" ? "json" : "markdown";
      index += 1;
      continue;
    }

    if (arg.startsWith("--format=")) {
      format = arg.slice("--format=".length) === "json" ? "json" : "markdown";
      continue;
    }

    if (!arg.startsWith("--")) {
      domains.add(arg.replace(/^https?:\/\//, "").replace(/\/$/, ""));
    }
  }

  return { domains, format };
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function buildCoverageRows(cases: TechBenchmarkCase[], results: BenchmarkCaseResult[]): ProviderCoverageRow[] {
  const coverage = new Map<string, ProviderCoverageRow>();

  for (const benchmarkCase of cases) {
    for (const technology of benchmarkCase.requiredTech) {
      const row = coverage.get(technology) ?? {
        technology,
        expectedOn: [],
        detectedOn: [],
        missingOn: [],
      };
      row.expectedOn.push(benchmarkCase.domain);
      coverage.set(technology, row);
    }
  }

  for (const result of results) {
    for (const row of coverage.values()) {
      if (!row.expectedOn.includes(result.domain)) {
        continue;
      }

      if (result.detectedTech.includes(row.technology)) {
        row.detectedOn.push(result.domain);
      } else {
        row.missingOn.push(result.domain);
      }
    }
  }

  return Array.from(coverage.values()).sort((left, right) => {
    const delta = right.expectedOn.length - left.expectedOn.length;
    if (delta !== 0) {
      return delta;
    }
    return left.technology.localeCompare(right.technology);
  });
}

function buildMarkdownReport(report: BenchmarkReport): string {
  const lines: string[] = [];
  lines.push(`# Tech Benchmark Report`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(
    `Summary: ${report.summary.totalCases} cases, ${report.summary.failingStableCases} failing stable cases, ${report.summary.unstableCases} unstable cases`,
  );
  lines.push("");
  lines.push("## Case Results");
  lines.push("");
  lines.push("| Domain | Status | Framework | Host | Missing Required | Unexpected Detections |");
  lines.push("| --- | --- | --- | --- | --- | --- |");

  for (const result of report.cases) {
    lines.push(
      `| ${result.domain} | ${result.status} | ${result.framework ?? "n/a"} | ${result.host ?? "n/a"} | ${formatList(result.missingRequired)} | ${formatList(result.forbiddenHits)} |`,
    );
  }

  const missingCases = report.cases.filter((result) => result.missingRequired.length > 0);
  lines.push("");
  lines.push("## Missing Required Detections");
  lines.push("");
  if (missingCases.length === 0) {
    lines.push("- none");
  } else {
    for (const result of missingCases) {
      lines.push(`- ${result.domain}: ${result.missingRequired.join(", ")}`);
    }
  }

  const unexpectedCases = report.cases.filter((result) => result.forbiddenHits.length > 0);
  lines.push("");
  lines.push("## Unexpected Detections");
  lines.push("");
  if (unexpectedCases.length === 0) {
    lines.push("- none");
  } else {
    for (const result of unexpectedCases) {
      lines.push(`- ${result.domain}: ${result.forbiddenHits.join(", ")}`);
    }
  }

  const unstableCases = report.cases.filter((result) => result.unstable || result.status === "error");
  lines.push("");
  lines.push("## Unstable Targets");
  lines.push("");
  if (unstableCases.length === 0) {
    lines.push("- none");
  } else {
    for (const result of unstableCases) {
      lines.push(
        `- ${result.domain}: ${result.status}${result.error ? ` (${result.error})` : ""}`,
      );
    }
  }

  lines.push("");
  lines.push("## Provider Coverage Matrix");
  lines.push("");
  lines.push("| Technology | Expected On | Detected On | Missing On |");
  lines.push("| --- | --- | --- | --- |");

  for (const row of report.providerCoverage) {
    lines.push(
      `| ${row.technology} | ${formatList(row.expectedOn)} | ${formatList(row.detectedOn)} | ${formatList(row.missingOn)} |`,
    );
  }

  return lines.join("\n");
}

function isStableFailure(result: BenchmarkCaseResult): boolean {
  return !result.unstable && (
    result.status !== "online" ||
    result.missingRequired.length > 0 ||
    result.forbiddenHits.length > 0
  );
}

async function runCase(benchmarkCase: TechBenchmarkCase): Promise<BenchmarkCaseResult> {
  try {
    const analysis = await analyzeUrl(benchmarkCase.domain);
    const detectedTech = analysis.technologies.map((technology) => technology.name);
    const detectedSet = new Set(detectedTech);

    return {
      domain: benchmarkCase.domain,
      repoUrl: benchmarkCase.repoUrl,
      truthSource: benchmarkCase.truthSource,
      notes: benchmarkCase.notes,
      unstable: benchmarkCase.unstable ?? false,
      status: analysis.status,
      executionEngine: analysis.execution.engine,
      framework: analysis.framework,
      host: analysis.host,
      detectedTech,
      missingRequired: benchmarkCase.requiredTech.filter((technology) => !detectedSet.has(technology)),
      optionalMatched: benchmarkCase.optionalTech.filter((technology) => detectedSet.has(technology)),
      forbiddenHits: benchmarkCase.forbiddenTech.filter((technology) => detectedSet.has(technology)),
    };
  } catch (error) {
    return {
      domain: benchmarkCase.domain,
      repoUrl: benchmarkCase.repoUrl,
      truthSource: benchmarkCase.truthSource,
      notes: benchmarkCase.notes,
      unstable: benchmarkCase.unstable ?? false,
      status: "error",
      detectedTech: [],
      missingRequired: [...benchmarkCase.requiredTech],
      optionalMatched: [],
      forbiddenHits: [],
      error: error instanceof Error ? error.message : "Unknown benchmark error",
    };
  }
}

async function main(): Promise<void> {
  const { domains, format } = parseArgs(process.argv.slice(2));
  const cases = TECH_BENCHMARK_CASES.filter((benchmarkCase) =>
    domains.size === 0 ? true : domains.has(benchmarkCase.domain),
  );

  if (cases.length === 0) {
    throw new Error("No benchmark cases matched the provided filters.");
  }

  const results: BenchmarkCaseResult[] = [];
  for (const benchmarkCase of cases) {
    results.push(await runCase(benchmarkCase));
  }

  const report: BenchmarkReport = {
    generatedAt: new Date().toISOString(),
    cases: results,
    providerCoverage: buildCoverageRows(cases, results),
    summary: {
      totalCases: results.length,
      failingStableCases: results.filter(isStableFailure).length,
      unstableCases: results.filter((result) => result.unstable || result.status === "error").length,
    },
  };

  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(buildMarkdownReport(report));
  }

  process.exitCode = results.some(isStableFailure) ? 1 : 0;
}

await main();
