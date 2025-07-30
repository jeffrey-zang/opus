import { RateLimiterMemory } from "rate-limiter-flexible";
import { NextRequest } from "next/server";

const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
  blockDuration: 60 * 15
});

export interface RateLimitResult {
  success: boolean;
  remainingPoints: number;
  resetTime: number;
  error?: string;
}

export async function checkRateLimit(
  req: NextRequest
): Promise<RateLimitResult> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ip = forwarded ? forwarded.split(",")[0] : realIp || "unknown";
    const result = await rateLimiter.consume(ip);

    return {
      success: true,
      remainingPoints: result.remainingPoints,
      resetTime: result.msBeforeNext
    };
  } catch (error: any) {
    if (error.remainingPoints === 0) {
      return {
        success: false,
        remainingPoints: 0,
        resetTime: error.msBeforeNext,
        error: "Rate limit exceeded. Please try again later."
      };
    }

    return {
      success: false,
      remainingPoints: 0,
      resetTime: 0,
      error: "Rate limiting error"
    };
  }
}
