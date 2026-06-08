import { z } from "zod"

const staffUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9._-]+$/i, "Username may only contain letters, numbers, dots, underscores, and hyphens.")

export const listStaffMembersQuerySchema = z.object({
  role: z.string().trim().optional(),
})

export const createStaffMemberBodySchema = z.object({
  username: staffUsernameSchema,
  password: z.string().min(8),
  displayName: z.string().trim().min(1).max(120).optional(),
  role: z.literal("CAPTION_WRITER").default("CAPTION_WRITER"),
})

export const staffMemberIdParamSchema = z.object({
  memberId: z.string().uuid(),
})

export const patchStaffMemberBodySchema = z
  .object({
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    password: z.string().min(8).optional(),
  })
  .refine((value) => value.status !== undefined || value.displayName !== undefined || value.password !== undefined, {
    message: "At least one field is required.",
  })
