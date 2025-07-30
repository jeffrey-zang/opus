import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, waitlist } from "../../../db";
import {
  waitlistRequestSchema,
  type ErrorResponse,
  type SuccessResponse
} from "../../../lib/validation";
import { checkRateLimit } from "../../../lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: rateLimitResult.error || "Rate limit exceeded",
          code: "RATE_LIMIT_EXCEEDED"
        } as ErrorResponse,
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": rateLimitResult.remainingPoints.toString(),
            "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
            "Retry-After": Math.ceil(
              rateLimitResult.resetTime / 1000
            ).toString()
          }
        }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
          code: "INVALID_JSON"
        } as ErrorResponse,
        { status: 400 }
      );
    }

    const validationResult = waitlistRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            validationResult.error.errors[0]?.message || "Validation failed",
          code: "VALIDATION_ERROR"
        } as ErrorResponse,
        { status: 400 }
      );
    }

    const { email } = validationResult.data;

    const existingEntry = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, email))
      .limit(1);

    if (existingEntry.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Email already registered",
          code: "EMAIL_EXISTS"
        } as ErrorResponse,
        { status: 409 }
      );
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ipAddress = forwarded ? forwarded.split(",")[0] : realIp || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const [newEntry] = await db
      .insert(waitlist)
      .values({
        email,
        ipAddress,
        userAgent,
        isActive: true
      })
      .returning({
        id: waitlist.id,
        email: waitlist.email,
        createdAt: waitlist.createdAt
      });

    return NextResponse.json(
      {
        success: true,
        message: "Successfully added to waitlist",
        data: {
          email: newEntry.email,
          id: newEntry.id
        }
      } as SuccessResponse,
      {
        status: 201,
        headers: {
          "X-RateLimit-Remaining": rateLimitResult.remainingPoints.toString(),
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString()
        }
      }
    );
  } catch (error) {
    console.error("Waitlist API error:", error);

    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json(
        {
          success: false,
          error: "Email already registered",
          code: "EMAIL_EXISTS"
        } as ErrorResponse,
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR"
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED"
    } as ErrorResponse,
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      success: false,
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED"
    } as ErrorResponse,
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED"
    } as ErrorResponse,
    { status: 405 }
  );
}
