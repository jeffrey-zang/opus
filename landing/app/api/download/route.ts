import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.redirect("https://www.tryop.us/download/Opus.dmg", 307);
}
