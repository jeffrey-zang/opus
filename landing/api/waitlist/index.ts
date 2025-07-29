import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../src/db";
import { waitlist } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { validateEmail, sanitizeEmail } from "../src/utils/validation";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "POST") {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const existingEntry = await db
        .select()
        .from(waitlist)
        .where(eq(waitlist.email, email.toLowerCase()))
        .limit(1);

      if (existingEntry.length > 0) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const ipAddress =
        req.headers["x-forwarded-for"] ||
        req.headers["x-real-ip"] ||
        req.connection.remoteAddress ||
        "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const [newEntry] = await db
        .insert(waitlist)
        .values({
          email: sanitizeEmail(email),
          ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
          userAgent
        })
        .returning();

      return res.status(201).json({
        message: "Successfully joined waitlist",
        id: newEntry.id
      });
    } catch (error) {
      console.error("Waitlist submission error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "GET") {
    try {
      const totalEntries = await db
        .select({ count: waitlist.id })
        .from(waitlist)
        .where(eq(waitlist.isActive, true));

      return res.status(200).json({
        totalEntries: totalEntries.length
      });
    } catch (error) {
      console.error("Error fetching waitlist stats:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
