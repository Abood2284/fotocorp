export interface SubmitContributorApplicationInput {
  firstName: string
  lastName: string
  proposedUsername: string
  email?: string
  phoneCountryCode?: string
  phoneNumber?: string
  applicationNotes?: string
}

export class ContributorApplicationApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "ContributorApplicationApiError"
  }
}

export async function submitContributorApplication(input: SubmitContributorApplicationInput) {
  const response = await fetch("/api/public/contributor-applications", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    let code = "REQUEST_FAILED"
    let message = "Could not submit your application."
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } }
      code = body.error?.code ?? code
      message = body.error?.message ?? message
    } catch {
      // ignore parse errors
    }
    throw new ContributorApplicationApiError(response.status, code, message)
  }

  return response.json() as Promise<{ ok: true; inquiryId: string; status: string; createdAt: string }>
}
