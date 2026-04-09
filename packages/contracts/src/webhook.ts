import { z } from "zod";

export const supportedWebhookEvents = [
  "crawl.completed",
  "crawl.failed",
  "uptime.down",
  "uptime.up",
] as const;

export type SupportedWebhookEvent = (typeof supportedWebhookEvents)[number];

export const webhookPayloadSchema = z.object({
  event: z.enum(supportedWebhookEvents),
  jobId: z.string().optional(),
  websiteId: z.string().min(1),
  userId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.string().optional(),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
