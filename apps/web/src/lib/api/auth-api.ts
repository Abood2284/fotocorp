export interface BusinessEmailValidationPayload {
  email: string
}

export interface BusinessEmailValidationResponse {
  ok: boolean
  decision: string
  message: string
}

export async function validateBusinessEmail({
  email,
}: BusinessEmailValidationPayload): Promise<BusinessEmailValidationResponse> {
  const response = await fetch("/api/auth/business-email/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email }),
  })

  const payload = (await response.json()) as Partial<BusinessEmailValidationResponse>

  return {
    ok: Boolean(payload.ok),
    decision: String(payload.decision ?? "VALIDATION_ERROR"),
    message: String(payload.message ?? "Email validation is temporarily unavailable. Please try again."),
  }
}
