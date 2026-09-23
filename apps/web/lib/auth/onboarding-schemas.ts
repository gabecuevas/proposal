import { z } from "zod";

export const TERMS_VERSION = "2026-09-23";
export const PRIVACY_VERSION = "2026-09-23";

export const passwordSchema = z
  .string()
  .min(15, "Password must be at least 15 characters")
  .max(128, "Password must be at most 128 characters");

export const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  email: z.string().trim().email("Enter a valid work email").max(254),
  password: passwordSchema,
  companyName: z.string().trim().min(1, "Company name is required").max(120),
  acceptTerms: z.literal(true, {
    message: "You must accept the Terms and Privacy Policy",
  }),
  marketingConsent: z.boolean().optional(),
});

export const companySetupSchema = z
  .object({
    companyName: z.string().trim().min(2).max(120),
    website: z.string().trim().max(500).optional().or(z.literal("")),
    noWebsite: z.boolean().default(false),
    companySize: z
      .enum(["just_me", "2_10", "11_50", "51_200", "201_500", "501_plus"])
      .optional()
      .nullable(),
    industry: z.string().trim().max(120).optional().or(z.literal("")),
    country: z.string().trim().min(2).max(2),
    timezone: z.string().trim().min(1).max(80),
    currency: z.string().trim().min(3).max(3),
    logoAssetKey: z.string().trim().max(500).optional().nullable(),
    onboardingOperationId: z.string().trim().min(8).max(80).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.noWebsite && !value.website?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Website is required unless you check “I don't have a website”",
        path: ["website"],
      });
    }
  });

export const inviteRowSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const teamInviteSchema = z.object({
  invites: z.array(inviteRowSchema).max(20),
});

export function normalizeIdentityEmail(email: string): string {
  return email.trim().toLowerCase();
}
