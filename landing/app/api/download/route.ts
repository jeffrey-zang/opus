import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "download", "Opus.dmg");

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Opus.dmg not found", { status: 404 });
  }

  const file = fs.readFileSync(filePath);
  const stats = fs.statSync(filePath);

  const headers = new Headers();
  headers.set("Content-Type", "application/octet-stream");
  headers.set("Content-Disposition", 'attachment; filename="Opus.dmg"');
  headers.set("Content-Length", stats.size.toString());

  return new NextResponse(file, {
    headers
  });
}
