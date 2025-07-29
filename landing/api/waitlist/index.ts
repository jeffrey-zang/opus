import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../../src/db";
import { waitlist } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { validateEmail, sanitizeEmail } from "../../src/utils/validation";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("Waitlist API called:", req.method, req.url);

  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    if (req.method === "POST") {
      console.log("Processing POST request");

      try {
        const { email } = req.body;
        console.log("Received email:", email);

        if (!email || typeof email !== "string") {
          console.log("Invalid email format");
          return res.status(400).json({ error: "Email is required" });
        }

        if (!validateEmail(email)) {
          console.log("Email validation failed");
          return res.status(400).json({ error: "Invalid email format" });
        }

        console.log("Getting database connection");
        const db = getDb();

        console.log("Checking for existing entry");
        const existingEntry = await db
          .select()
          .from(waitlist)
          .where(eq(waitlist.email, email.toLowerCase()))
          .limit(1);

        if (existingEntry.length > 0) {
          console.log("Email already exists");
          return res.status(409).json({ error: "Email already registered" });
        }

        const ipAddress =
          req.headers["x-forwarded-for"] ||
          req.headers["x-real-ip"] ||
          req.connection.remoteAddress ||
          "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        console.log("Inserting new entry");
        const [newEntry] = await db
          .insert(waitlist)
          .values({
            email: sanitizeEmail(email),
            ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
            userAgent
          })
          .returning();

        console.log("Entry created successfully:", newEntry.id);
        return res.status(201).json({
          message: "Successfully joined waitlist",
          id: newEntry.id
        });
      } catch (error) {
        console.error("Waitlist submission error:", error);
        return res.status(500).json({
          error: "Internal server error",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    if (req.method === "GET") {
      console.log("Processing GET request");

      try {
        const db = getDb();
        const totalEntries = await db
          .select({ count: waitlist.id })
          .from(waitlist)
          .where(eq(waitlist.isActive, true));

        console.log("Total entries:", totalEntries.length);
        return res.status(200).json({
          totalEntries: totalEntries.length
        });
      } catch (error) {
        console.error("Error fetching waitlist stats:", error);
        return res.status(500).json({
          error: "Internal server error",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    console.log("Method not allowed:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
