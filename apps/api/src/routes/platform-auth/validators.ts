import { z } from "zod"

export const platformLoginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  /** USER = subscribers only; CONTRIBUTOR = portal only; ANY = try both (legacy). */
  scope: z.enum(["USER", "CONTRIBUTOR", "ANY"]).optional().default("ANY"),
})

export const platformSignUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  username: z.string().trim().min(3).max(30),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  companyType: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
  jobTitle: z.string().trim().min(1),
  customJobTitle: z.string().trim().optional(),
  companyEmail: z.string().trim().email("Enter a valid company email.").optional(),
  phoneCountryCode: z.string().trim().min(1),
  phoneNumber: z.string().trim().min(1),
  interestedAssetTypes: z.array(z.enum(["IMAGE", "VIDEO", "CARICATURE"])).min(1),
  imageQuantityRange: z.string().trim().optional(),
  imageQualityPreference: z.string().trim().optional(),
  name: z.string().trim().optional(),
})
