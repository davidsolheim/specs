import { describe, expect, test } from "bun:test";

import {
  QUEUE_NAMES,
  analysisExecutionEngineSchema,
  supportedWebhookEvents,
  webhookPayloadSchema,
} from "../src/index.js";

describe("contracts smoke", () => {
  test("exports the canonical queue names", () => {
    expect(QUEUE_NAMES).toEqual({
      HTTP_CRAWLER: "crawl-http",
      BROWSER_CRAWLER: "crawl-browser",
      SEO_ANALYZER: "crawl-seo",
      UPTIME_MONITOR: "uptime-check",
    });
  });

  test("accepts the supported webhook payload shape", () => {
    const payload = webhookPayloadSchema.parse({
      event: supportedWebhookEvents[0],
      websiteId: "site_123",
      data: {},
    });

    expect(payload.event).toBe("crawl.completed");
    expect(payload.websiteId).toBe("site_123");
  });

  test("includes local browser execution engines in the analysis contract", () => {
    expect(analysisExecutionEngineSchema.safeParse("agent-browser").success).toBe(true);
    expect(analysisExecutionEngineSchema.safeParse("agent-browser+http").success).toBe(true);
  });
});
