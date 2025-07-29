import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  try {
    console.log("Test function executed successfully");

    const databaseUrl = process.env.DATABASE_URL;
    console.log("DATABASE_URL exists:", !!databaseUrl);

    try {
      const { db } = await import("../../src/db");
      console.log("Database import successful");

      try {
        await db.execute("SELECT 1");
        console.log("Database connection successful");
      } catch (dbError) {
        console.error("Database connection failed:", dbError);
      }
    } catch (importError) {
      console.error("Database import failed:", importError);
    }

    return res.status(200).json({
      message: "Test function working",
      timestamp: new Date().toISOString(),
      env: {
        hasDatabaseUrl: !!databaseUrl,
        nodeEnv: process.env.NODE_ENV
      }
    });
  } catch (error) {
    console.error("Test function error:", error);
    return res.status(500).json({
      error: "Test function failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
