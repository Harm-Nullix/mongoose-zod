import { defineEventHandler, createError, getRequestIP } from "h3";

// Simple in-memory rate limiting map: IP -> array of timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 2; // 2 requests
const TIME_WINDOW = 1000; // per 1 second (1000ms)

export default defineEventHandler((event) => {
  const isDocsMode = process.env.DOCS_MODE === "true";
  const path = event.path;

  // 1. Environment Check: Disable local resolving in Docs mode
  if (isDocsMode && path.startsWith("/api/resolve")) {
    throw createError({
      statusCode: 403,
      message: "Filesystem resolution is disabled in Documentation Mode.",
    });
  }

  // 2. Rate Limiting for Parse endpoint in Docs Mode
  if (isDocsMode && path.startsWith("/api/parse")) {
    const ip = getRequestIP(event) || "unknown";
    const now = Date.now();

    const timestamps = rateLimitMap.get(ip) || [];

    // Filter timestamps within the current window
    const recentRequests = timestamps.filter((t) => now - t < TIME_WINDOW);

    if (recentRequests.length >= RATE_LIMIT) {
      throw createError({
        statusCode: 429,
        message: "Too Many Requests. Limit is 2 requests per second.",
      });
    }

    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);
  }
});
