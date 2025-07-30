import { z } from "zod";
import validator from "validator";

// Email validation schema
export const emailSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Invalid email format")
    .refine((email) => validator.isEmail(email), {
      message: "Invalid email format"
    })
    .transform((email) => email.toLowerCase().trim())
});

// Request body schema
export const waitlistRequestSchema = emailSchema;

// Response schemas
export const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    email: z.string(),
    id: z.string()
  })
});

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional()
});

export type WaitlistRequest = z.infer<typeof waitlistRequestSchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
