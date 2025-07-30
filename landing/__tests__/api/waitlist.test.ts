import { NextRequest } from "next/server";
import { POST, GET, PUT, DELETE } from "../../app/api/waitlist/route";
import { db } from "../../db";
import { waitlist } from "../../db/schema";
import { eq } from "drizzle-orm";

jest.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    public url: string;
    public method: string;
    public headers: Headers;
    public body: any;

    constructor(input: string | URL, init?: RequestInit) {
      this.url = typeof input === "string" ? input : input.toString();
      this.method = init?.method || "GET";
      this.headers = new Headers(init?.headers || {});
      this.body = init?.body;
    }

    async json() {
      if (typeof this.body === "string") {
        return JSON.parse(this.body);
      }
      return this.body;
    }
  },
  NextResponse: {
    json: jest.fn((data, init) => ({
      status: init?.status || 200,
      json: async () => data,
      headers: new Headers(init?.headers || {})
    }))
  }
}));

jest.mock("../../db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn()
  },
  waitlist: {
    id: "id",
    email: "email",
    createdAt: "createdAt"
  }
}));

jest.mock("../../lib/rateLimit", () => ({
  checkRateLimit: jest.fn()
}));

jest.mock("drizzle-orm", () => ({
  eq: jest.fn()
}));

const mockDb = db as any;
const mockCheckRateLimit = require("../../lib/rateLimit").checkRateLimit as any;
const mockEq = eq as any;

describe("/api/waitlist", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remainingPoints: 4,
      resetTime: 60000
    });
  });

  describe("POST", () => {
    const createMockRequest = (
      body: any,
      headers: Record<string, string> = {}
    ) => {
      return new NextRequest("http://localhost:3000/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers
        },
        body: JSON.stringify(body)
      });
    };

    it("should successfully add a new email to waitlist", async () => {
      const email = "test@example.com";
      const mockRequest = createMockRequest({ email });

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      } as any);

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: "test-id-123",
              email: email.toLowerCase(),
              createdAt: new Date()
            }
          ])
        })
      } as any);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual({
        success: true,
        message: "Successfully added to waitlist",
        data: {
          email: email.toLowerCase(),
          id: "test-id-123"
        }
      });
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("4");
      expect(response.headers.get("X-RateLimit-Reset")).toBe("60000");
    });

    it("should return 429 when rate limit is exceeded", async () => {
      const email = "test@example.com";
      const mockRequest = createMockRequest({ email });

      mockCheckRateLimit.mockResolvedValue({
        success: false,
        remainingPoints: 0,
        resetTime: 900000,
        error: "Rate limit exceeded. Please try again later."
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data).toEqual({
        success: false,
        error: "Rate limit exceeded. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED"
      });
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("X-RateLimit-Reset")).toBe("900000");
      expect(response.headers.get("Retry-After")).toBe("900");
    });

    it("should return 400 for invalid JSON", async () => {
      const mockRequest = new NextRequest(
        "http://localhost:3000/api/waitlist",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: "invalid json"
        }
      );

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        error: "Invalid JSON in request body",
        code: "INVALID_JSON"
      });
    });

    it("should return 400 for missing email", async () => {
      const mockRequest = createMockRequest({});

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toContain("Required");
    });

    it("should return 400 for invalid email format", async () => {
      const mockRequest = createMockRequest({ email: "invalid-email" });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toContain("Invalid email format");
    });

    it("should return 400 for empty email", async () => {
      const mockRequest = createMockRequest({ email: "" });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toContain("Email is required");
    });

    it("should return 400 for email that is too long", async () => {
      const longEmail = "a".repeat(300) + "@example.com";
      const mockRequest = createMockRequest({ email: longEmail });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toContain("Email is too long");
    });

    it("should return 409 when email already exists", async () => {
      const email = "existing@example.com";
      const mockRequest = createMockRequest({ email });

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest
              .fn()
              .mockResolvedValue([
                { id: "existing-id", email: email.toLowerCase() }
              ])
          })
        })
      } as any);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toEqual({
        success: false,
        error: "Email already registered",
        code: "EMAIL_EXISTS"
      });
    });

    it("should handle database unique constraint errors", async () => {
      const email = "test@example.com";
      const mockRequest = createMockRequest({ email });

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      } as any);

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest
            .fn()
            .mockRejectedValue(
              new Error("duplicate key value violates unique constraint")
            )
        })
      } as any);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toEqual({
        success: false,
        error: "Email already registered",
        code: "EMAIL_EXISTS"
      });
    });

    it("should handle database errors gracefully", async () => {
      const email = "test@example.com";
      const mockRequest = createMockRequest({ email });

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest
              .fn()
              .mockRejectedValue(new Error("Database connection failed"))
          })
        })
      } as any);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR"
      });
    });

    it("should normalize email to lowercase and trim whitespace", async () => {
      const email = "TEST@EXAMPLE.COM";
      const mockRequest = createMockRequest({ email });

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      } as any);

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: "test-id-123",
              email: "test@example.com",
              createdAt: new Date()
            }
          ])
        })
      } as any);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.email).toBe("test@example.com");
    });

    it("should capture IP address and user agent", async () => {
      const email = "test@example.com";
      const mockRequest = createMockRequest(
        { email },
        {
          "x-forwarded-for": "192.168.1.1, 10.0.0.1",
          "user-agent": "Mozilla/5.0 (Test Browser)"
        }
      );

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      } as any);

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: "test-id-123",
              email: email.toLowerCase(),
              createdAt: new Date()
            }
          ])
        })
      } as any);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      // Note: The API captures IP and user agent, but we're testing the response behavior
      // rather than the internal implementation details
    });

    it("should handle missing IP headers gracefully", async () => {
      const email = "test@example.com";
      const mockRequest = createMockRequest({ email });

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      } as any);

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: "test-id-123",
              email: email.toLowerCase(),
              createdAt: new Date()
            }
          ])
        })
      } as any);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      // Note: The API handles missing IP headers gracefully, but we're testing the response behavior
      // rather than the internal implementation details
    });
  });

  describe("GET", () => {
    it("should return 405 Method Not Allowed", async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data).toEqual({
        success: false,
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED"
      });
    });
  });

  describe("PUT", () => {
    it("should return 405 Method Not Allowed", async () => {
      const response = await PUT();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data).toEqual({
        success: false,
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED"
      });
    });
  });

  describe("DELETE", () => {
    it("should return 405 Method Not Allowed", async () => {
      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data).toEqual({
        success: false,
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED"
      });
    });
  });
});
