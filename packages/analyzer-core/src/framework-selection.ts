import { TechCategory } from "./tech-rules.js";

type FrameworkLike = {
  category: string;
  confidence?: string;
  name: string;
};

const FRAMEWORK_PRIORITY: Record<string, number> = {
  Docsy: 300,
  Hugo: 290,
  VitePress: 280,
  Docusaurus: 270,
  Gatsby: 260,
  "Next.js": 240,
  Nuxt: 235,
  SvelteKit: 230,
  Astro: 225,
  Remix: 220,
  Qwik: 215,
  Angular: 210,
  Solid: 150,
  "Vue.js": 100,
  Svelte: 100,
  React: 90,
  Preact: 80,
  "Ember.js": 70,
  Lit: 65,
  "Alpine.js": 60,
  Express: 40,
};

const LOW_SIGNAL_RUNTIME_FRAMEWORKS = new Set([
  "React",
  "Vue.js",
  "Svelte",
  "Preact",
  "Lit",
  "Alpine.js",
]);

const CONFIDENCE_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function getFrameworkPriority(detection: FrameworkLike): number {
  return FRAMEWORK_PRIORITY[detection.name] ?? 0;
}

function getConfidenceRank(detection: FrameworkLike): number {
  return detection.confidence ? (CONFIDENCE_RANK[detection.confidence] ?? 0) : 0;
}

function isFrameworkCategory(category: string): boolean {
  return (
    category === TechCategory.JAVASCRIPT_FRAMEWORK ||
    category === TechCategory.WEB_FRAMEWORK
  );
}

export function getSortedFrameworkCandidates<T extends FrameworkLike>(detections: T[]): T[] {
  return detections
    .filter((detection) => isFrameworkCategory(detection.category))
    .slice()
    .sort((left, right) => {
      const priorityDelta = getFrameworkPriority(right) - getFrameworkPriority(left);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const confidenceDelta = getConfidenceRank(right) - getConfidenceRank(left);
      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }

      return left.name.localeCompare(right.name);
    });
}

export function getPrimaryFrameworkName<T extends FrameworkLike>(detections: T[]): string | undefined {
  const primaryFramework = getSortedFrameworkCandidates(detections)[0];
  if (!primaryFramework) {
    return undefined;
  }

  const hasHighConfidenceCms = detections.some(
    (detection) =>
      (detection.category === TechCategory.CMS || detection.category === TechCategory.ECOMMERCE) &&
      getConfidenceRank(detection) === 3,
  );

  if (
    hasHighConfidenceCms &&
    LOW_SIGNAL_RUNTIME_FRAMEWORKS.has(primaryFramework.name) &&
    getConfidenceRank(primaryFramework) < 3
  ) {
    return undefined;
  }

  return primaryFramework.name;
}
