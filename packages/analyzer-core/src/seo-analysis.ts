import * as cheerio from "cheerio";

export interface SeoRecommendation {
  type: "critical" | "warning" | "suggestion";
  category: string;
  message: string;
}

export interface SeoAnalysis {
  score: number;
  title?: string;
  description?: string;
  hasSSL: boolean;
  mobileOptimized: boolean;
  wordCount: number;
  canonicalUrl?: string;
  robots?: string;
  sitemapUrls: string[];
  internalLinks: number;
  externalLinks: number;
  imagesCount: number;
  imagesWithoutAlt: number;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  recommendations: SeoRecommendation[];
}

export function analyzeSeoPage(
  url: string,
  html: string,
  _headers: Record<string, string>,
): SeoAnalysis {
  const $ = cheerio.load(html);

  const title = $("title").text() || undefined;
  const metaDescription = $('meta[name="description"]').attr("content") || undefined;
  const canonical = $('link[rel="canonical"]').attr("href");
  const robots = $('meta[name="robots"]').attr("content");
  const sitemapUrls = Array.from(
    new Set(
      $('link[rel="sitemap"], a[href*="sitemap"]')
        .toArray()
        .map((el) => $(el).attr("href"))
        .filter((href): href is string => Boolean(href))
        .map((href) => {
          try {
            return new URL(href, url).toString();
          } catch {
            return href;
          }
        }),
    ),
  );

  const h1Count = $("h1").length;
  const h2Count = $("h2").length;
  const h3Count = $("h3").length;

  const allLinks = $("a[href]");
  const hostname = new URL(url).hostname;
  const internalLinks = allLinks.toArray().filter((el) => {
    const href = $(el).attr("href");
    return href && (href.startsWith("/") || href.includes(hostname));
  }).length;
  const externalLinks = allLinks.length - internalLinks;

  const images = $("img");
  const imagesCount = images.length;
  const imagesWithoutAlt = images.filter((_, el) => !$(el).attr("alt")).length;

  const bodyText = $("body").text();
  const wordCount = bodyText.split(/\s+/).filter((word) => word.length > 0).length;

  const hasSSL = url.startsWith("https://");
  const mobileOptimized = Boolean(
    $('meta[name="viewport"]').attr("content")?.includes("width=device-width"),
  );
  const hasCanonical = Boolean(canonical);
  const hasRobots = Boolean(robots);
  const hasSitemap = Boolean($('link[rel="sitemap"]').attr("href"));
  const structuredDataScripts = $('script[type="application/ld+json"]').length;

  const score = calculateSeoScore({
    title,
    metaDescription,
    h1Count,
    hasCanonical,
    hasRobots,
    hasSitemap,
    hasSSL,
    mobileOptimized,
    wordCount,
    internalLinks,
    imagesWithoutAlt,
    imagesCount,
    structuredDataScripts,
  });

  return {
    score,
    title,
    description: metaDescription,
    hasSSL,
    mobileOptimized,
    wordCount,
    canonicalUrl: canonical,
    robots,
    sitemapUrls,
    internalLinks,
    externalLinks,
    imagesCount,
    imagesWithoutAlt,
    h1Count,
    h2Count,
    h3Count,
    recommendations: generateRecommendations({
      title,
      metaDescription,
      h1Count,
      hasCanonical,
      hasRobots,
      hasSitemap,
      hasSSL,
      mobileOptimized,
      wordCount,
      imagesWithoutAlt,
      imagesCount,
      internalLinks,
      externalLinks,
      structuredDataScripts,
    }),
  };
}

function calculateSeoScore(metrics: {
  title?: string;
  metaDescription?: string;
  h1Count: number;
  hasCanonical: boolean;
  hasRobots: boolean;
  hasSitemap: boolean;
  hasSSL: boolean;
  mobileOptimized: boolean;
  wordCount: number;
  internalLinks: number;
  imagesWithoutAlt: number;
  imagesCount: number;
  structuredDataScripts: number;
}) {
  let score = 0;

  if (metrics.title) {
    score += 5;
    if (metrics.title.length >= 30 && metrics.title.length <= 60) {
      score += 10;
    } else {
      score += 5;
    }
  }

  if (metrics.metaDescription) {
    score += 5;
    if (metrics.metaDescription.length >= 120 && metrics.metaDescription.length <= 160) {
      score += 10;
    } else {
      score += 5;
    }
  }

  if (metrics.h1Count === 1) {
    score += 10;
  } else if (metrics.h1Count > 0) {
    score += 5;
  }

  if (metrics.hasCanonical) score += 5;
  if (metrics.hasRobots) score += 5;
  if (metrics.hasSitemap) score += 5;
  if (metrics.hasSSL) score += 5;
  if (metrics.mobileOptimized) score += 10;

  if (metrics.wordCount >= 300) {
    score += 10;
  } else if (metrics.wordCount >= 100) {
    score += 5;
  }

  if (metrics.internalLinks >= 3) score += 5;

  if (metrics.imagesCount > 0) {
    const altRatio = 1 - metrics.imagesWithoutAlt / metrics.imagesCount;
    score += Math.round(altRatio * 10);
  }

  if (metrics.structuredDataScripts > 0) score += 5;

  return Math.min(100, score);
}

function generateRecommendations(metrics: {
  title?: string;
  metaDescription?: string;
  h1Count: number;
  hasCanonical: boolean;
  hasRobots: boolean;
  hasSitemap: boolean;
  hasSSL: boolean;
  mobileOptimized: boolean;
  wordCount: number;
  imagesWithoutAlt: number;
  imagesCount: number;
  internalLinks: number;
  externalLinks: number;
  structuredDataScripts: number;
}): SeoRecommendation[] {
  const recommendations: SeoRecommendation[] = [];

  if (!metrics.title) {
    recommendations.push({
      type: "critical",
      category: "Title",
      message: "Missing page title. Add a descriptive <title> tag.",
    });
  }

  if (!metrics.metaDescription) {
    recommendations.push({
      type: "critical",
      category: "Meta Description",
      message: "Missing meta description. Add a compelling description (120-160 characters).",
    });
  }

  if (metrics.h1Count === 0) {
    recommendations.push({
      type: "critical",
      category: "Headings",
      message: "Missing H1. Add a primary page heading.",
    });
  }

  if (!metrics.hasCanonical) {
    recommendations.push({
      type: "warning",
      category: "Canonical",
      message: "Missing canonical tag.",
    });
  }

  if (!metrics.hasSSL) {
    recommendations.push({
      type: "critical",
      category: "Security",
      message: "HTTPS is not enabled.",
    });
  }

  if (!metrics.mobileOptimized) {
    recommendations.push({
      type: "warning",
      category: "Mobile",
      message: "Missing responsive viewport metadata.",
    });
  }

  if (metrics.wordCount < 100) {
    recommendations.push({
      type: "suggestion",
      category: "Content",
      message: "Add more copy to improve content depth.",
    });
  }

  if (metrics.imagesCount > 0 && metrics.imagesWithoutAlt > 0) {
    recommendations.push({
      type: "warning",
      category: "Images",
      message: "Add alt text to images for accessibility and SEO.",
    });
  }

  if (metrics.internalLinks < 3) {
    recommendations.push({
      type: "suggestion",
      category: "Links",
      message: "Add more internal links to strengthen information architecture.",
    });
  }

  if (metrics.structuredDataScripts === 0) {
    recommendations.push({
      type: "suggestion",
      category: "Structured Data",
      message: "Add structured data to improve search engine understanding.",
    });
  }

  return recommendations;
}
