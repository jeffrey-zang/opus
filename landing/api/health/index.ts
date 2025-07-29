import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("Health check called");

  try {
    return res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      hasDatabaseUrl: !!process.env.DATABASE_URL
    });
  } catch (error) {
    console.error("Health check error:", error);
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
