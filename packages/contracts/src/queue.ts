export const QUEUE_NAMES = {
  HTTP_CRAWLER: "crawl-http",
  BROWSER_CRAWLER: "crawl-browser",
  SEO_ANALYZER: "crawl-seo",
  UPTIME_MONITOR: "uptime-check",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
export type CrawlJobType = "http" | "browser" | "seo";

export interface HttpCrawlerJobData {
  jobId: string;
  websiteId: string;
  userId: string;
  url: string;
  options?: {
    followRedirects?: boolean;
    timeout?: number;
    userAgent?: string;
  };
}

export interface BrowserCrawlerJobData {
  jobId: string;
  websiteId: string;
  userId: string;
  url: string;
  options?: {
    screenshot?: boolean;
    waitForSelector?: string;
    timeout?: number;
  };
}

export interface SeoAnalyzerJobData {
  jobId: string;
  websiteId: string;
  userId: string;
  url: string;
  options?: {
    maxPages?: number;
    depth?: number;
  };
}

export interface UptimeMonitorJobData {
  websiteId: string;
  url: string;
}

export type CrawlJobData =
  | HttpCrawlerJobData
  | BrowserCrawlerJobData
  | SeoAnalyzerJobData;
