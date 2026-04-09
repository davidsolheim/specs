import type { AnalysisTechnology } from "@sitespecs/contracts";

import { getPrimaryFrameworkName } from "./framework-selection.js";
import { detectHostFromURL } from "./host-detector.js";
import { TechDetectorEngine } from "./tech-detector-engine.js";
import { TechCategory } from "./tech-rules.js";

export async function detectTechnologies(input: {
  url: string;
  html: string;
  headers: Record<string, string>;
  cookies?: string[];
}): Promise<AnalysisTechnology[]> {
  const engine = new TechDetectorEngine();
  const detections = engine.filterByConfidence(await engine.detect(input), "medium");

  const hostDetection = await detectHostFromURL(input.url);
  if (hostDetection && !detections.some((item) => item.name === hostDetection.name)) {
    detections.push({
      name: hostDetection.name,
      category: hostDetection.category,
      confidence: hostDetection.confidence,
      description: `Detected via ${hostDetection.detectionMethod}`,
    });
  }

  return engine.deduplicate(detections).map((tech) => ({
    name: tech.name,
    version: tech.version,
    category: tech.category,
    confidence: tech.confidence,
    icon: tech.icon,
    website: tech.website,
  }));
}

export function getHostingProvider(detections: AnalysisTechnology[]): string | undefined {
  const hostingCategories = [TechCategory.PAAS, TechCategory.HOSTING, TechCategory.CDN];

  for (const category of hostingCategories) {
    const hosting = detections.find(
      (detection) => detection.category === category && detection.confidence === "high",
    );
    if (hosting) {
      return hosting.name;
    }
  }

  return undefined;
}

export function getFramework(detections: AnalysisTechnology[]): string | undefined {
  return getPrimaryFrameworkName(detections);
}
