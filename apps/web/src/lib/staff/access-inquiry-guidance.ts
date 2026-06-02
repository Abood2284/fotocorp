import { formatInquiryStatus } from "@/lib/staff/access-inquiry-labels"

export type InquiryStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "CLOSED"
  | "ACCESS_GRANTED"
  | "CONTRIBUTOR_APPROVED"
  | string

export type InquiryStatusFilter = "ALL" | InquiryStatus

interface EntitlementLike {
  status?: string | null
}

export interface InquiryGuidanceBlock {
  title: string
  summary: string
  nextSteps: string[]
}

export function inquiryStatusBadgeVariant(
  status: string | null | undefined,
): "warning" | "secondary" | "success" | "muted" | "destructive" {
  const s = (status ?? "").trim().toUpperCase()
  if (s === "PENDING") return "warning"
  if (s === "IN_REVIEW") return "secondary"
  if (s === "ACCESS_GRANTED" || s === "CONTRIBUTOR_APPROVED") return "success"
  if (s === "CLOSED") return "muted"
  return "muted"
}

export function canCloseInquiry(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toUpperCase()
  return s === "PENDING" || s === "IN_REVIEW"
}

function countByStatus(items: Array<{ status: string }>) {
  const counts = { pending: 0, inReview: 0, granted: 0, closed: 0, other: 0 }
  for (const row of items) {
    const s = row.status.trim().toUpperCase()
    if (s === "PENDING") counts.pending += 1
    else if (s === "IN_REVIEW") counts.inReview += 1
    else if (s === "ACCESS_GRANTED" || s === "CONTRIBUTOR_APPROVED") counts.granted += 1
    else if (s === "CLOSED") counts.closed += 1
    else counts.other += 1
  }
  return counts
}

/** List page help panel — reflects filter + queue composition. */
export function getAccessInquiriesListGuidance(input: {
  isContributor: boolean
  statusFilter: InquiryStatusFilter
  items: Array<{ status: string }>
}): InquiryGuidanceBlock {
  const counts = countByStatus(input.items)
  const grantedLabel = input.isContributor ? "Contributor approved" : "Access granted"
  const filter = input.statusFilter

  if (filter === "PENDING") {
    return {
      title: "Pending queue",
      summary: input.isContributor
        ? `${counts.pending} application(s) submitted and waiting for you. The contributor record exists but portal login is not issued until you approve.`
        : `${counts.pending} customer(s) finished signup but cannot download yet. Their platform account exists; download entitlements do not.`,
      nextSteps: input.isContributor
        ? [
            "Open a row to read the application and proposed username.",
            "Approve to issue portal credentials and a one-time password (copy it immediately).",
            "If unsuitable, close the inquiry from the detail page without approving.",
          ]
        : [
            "Open a row — status will move to In review when you generate entitlement drafts.",
            "Generate entitlement draft (one row per asset type they selected).",
            "Set allowed downloads and quality per type, then Activate each draft (customer receives an email per activation).",
            "Use Activate all drafts when every quota is ready — sends one combined email.",
          ],
    }
  }

  if (filter === "IN_REVIEW") {
    return {
      title: "In review",
      summary: input.isContributor
        ? "Contributor applications do not use this status."
        : `${counts.inReview} inquiry(ies) have draft entitlements and still need activation or adjustment.`,
      nextSteps: input.isContributor
        ? ["Switch to Pending or All to work contributor applications."]
        : [
            "Open each row and check entitlements — Draft means not downloadable yet.",
            "Activate every draft you intend to grant — each activation emails the customer their limits.",
            "Use Activate all drafts on the detail page when all quotas are set.",
            "Close the inquiry if you are denying access entirely.",
          ],
    }
  }

  if (filter === "ACCESS_GRANTED" || filter === "CONTRIBUTOR_APPROVED") {
    return {
      title: grantedLabel,
      summary: input.isContributor
        ? `${counts.granted} approved contributor(s). Credentials were issued; they sign in via Contributor on /sign-in.`
        : `${counts.granted} customer(s) with active entitlements on record. They can download within quota and quality caps.`,
      nextSteps: input.isContributor
        ? ["No action unless you need to verify portal access with the applicant.", "Historical rows stay here for audit."]
        : [
            "Adjust or suspend individual entitlements on the detail page if quotas change.",
            "Subscriber access line shows whether the users table still marks them active.",
          ],
    }
  }

  if (filter === "CLOSED") {
    return {
      title: "Closed",
      summary: `${counts.closed} closed without granting access (or archived after review). No further workflow steps.`,
      nextSteps: ["Re-open is not supported — create a new inquiry if the customer signs up again."],
    }
  }

  // ALL
  const actionCount = counts.pending + (input.isContributor ? 0 : counts.inReview)
  return {
    title: input.isContributor ? "Contributor applications" : "Customer access inquiries",
    summary:
      actionCount > 0
        ? input.isContributor
          ? `${counts.pending} pending approval. Pending = application received, not portal-ready.`
          : `${counts.pending} pending signup(s), ${counts.inReview} in review with drafts. Pending = registered, waiting for entitlements.`
        : input.isContributor
          ? "No pending applications in this tab."
          : "No pending or in-review customer inquiries in this tab.",
    nextSteps:
      actionCount > 0
        ? input.isContributor
          ? [
              `Start with ${counts.pending} Pending row(s) — open and approve or close.`,
              "Approved rows move to Contributor approved.",
            ]
          : [
              `Prioritize ${counts.pending} Pending — open row → Generate entitlement draft.`,
              counts.inReview > 0
                ? `Then finish ${counts.inReview} In review — activate all required drafts.`
                : "In review rows need Activate on each draft entitlement.",
              "Entitlements are per asset type (Images/Video/Caricature), not a single account toggle.",
            ]
        : input.isContributor
          ? ["New applications appear as Pending when submitted from /apply-contributor."]
          : ["New signups appear as Pending after registration.", "Use filters above to focus a status."],
  }
}

/** Compact hint for ? on a table row or status badge. */
export function getInquiryRowHint(input: {
  isContributor: boolean
  status: string
}): string {
  const s = input.status.trim().toUpperCase()
  const label = formatInquiryStatus(s)

  if (input.isContributor) {
    if (s === "PENDING") return `${label}: application received. Open to approve portal login or close to reject.`
    if (s === "CONTRIBUTOR_APPROVED") return `${label}: credentials issued. Applicant uses Contributor tab at /sign-in.`
    if (s === "CLOSED") return `${label}: not approved. No portal access was granted.`
    return `${label}. Open the row for details.`
  }

  if (s === "PENDING") {
    return `${label}: customer registered. Open → Generate entitlement draft → Activate downloads.`
  }
  if (s === "IN_REVIEW") {
    return `${label}: drafts exist. Open → Activate each entitlement (or close to deny).`
  }
  if (s === "ACCESS_GRANTED") {
    return `${label}: entitlements active. Open to adjust quotas or suspend per asset type.`
  }
  if (s === "CLOSED") return `${label}: access denied or inquiry archived.`
  return `${label}. Open the row for workflow details.`
}

export interface WorkflowStep {
  id: string
  label: string
  description: string
  state: "complete" | "current" | "upcoming" | "skipped"
}

export function getCustomerAccessDetailGuidance(input: {
  inquiryStatus: string
  entitlements: EntitlementLike[]
}): InquiryGuidanceBlock & { steps: WorkflowStep[]; canClose: boolean } {
  const status = input.inquiryStatus.trim().toUpperCase()
  const entitlements = input.entitlements
  const hasAny = entitlements.length > 0
  const draftCount = entitlements.filter((e) => String(e.status).toUpperCase() === "DRAFT").length
  const activeCount = entitlements.filter((e) => String(e.status).toUpperCase() === "ACTIVE").length
  const canClose = canCloseInquiry(status)

  const steps: WorkflowStep[] = [
    {
      id: "draft",
      label: "Generate drafts",
      description: "Create one draft entitlement per interested asset type (Images, Video, etc.).",
      state: "upcoming",
    },
    {
      id: "adjust",
      label: "Set quotas & quality",
      description: "Edit allowed downloads and max quality on each draft before activation.",
      state: "upcoming",
    },
    {
      id: "activate",
      label: "Activate entitlements",
      description: "Each activation turns on subscriber access for that asset type and emails the customer their limits.",
      state: "upcoming",
    },
  ]

  if (status === "CLOSED") {
    for (const step of steps) step.state = "skipped"
    return {
      title: "Closed",
      summary: "This inquiry was closed without granting download access (or was archived after review).",
      nextSteps: ["No further action. Customer may register again as a new inquiry."],
      steps,
      canClose: false,
    }
  }

  if (status === "ACCESS_GRANTED") {
    steps[0]!.state = "complete"
    steps[1]!.state = "complete"
    steps[2]!.state = "complete"
    return {
      title: "Access granted",
      summary: `${activeCount} active entitlement(s). Customer can download within allowed counts and quality caps.`,
      nextSteps: [
        "Use Adjust on an active entitlement to change caps — the customer is emailed about changes.",
        "Suspend removes download access for that asset type only.",
      ],
      steps,
      canClose: false,
    }
  }

  if (!hasAny && status === "PENDING") {
    steps[0]!.state = "current"
    return {
      title: "Waiting for entitlements",
      summary:
        "Customer completed signup. Entitlements are separate per asset type — not a single approve button.",
      nextSteps: [
        "Click Generate entitlement draft (moves inquiry to In review).",
        "Then set downloads/quality and Activate each type they need.",
      ],
      steps,
      canClose,
    }
  }

  if (draftCount > 0 || status === "IN_REVIEW") {
    steps[0]!.state = "complete"
    steps[1]!.state = draftCount > 0 ? "current" : "complete"
    steps[2]!.state = activeCount > 0 ? "current" : "upcoming"
    return {
      title: "Drafts in progress",
      summary: `${draftCount} draft(s), ${activeCount} active. Draft entitlements are not downloadable until activated.`,
      nextSteps: [
        draftCount > 0 ? `Activate ${draftCount} remaining draft(s) when quotas look correct — each sends a confirmation email.` : "All drafts activated.",
        "Inquiry becomes Access granted when entitlements are active.",
        canClose ? "Close inquiry if you are denying access entirely." : "",
      ].filter(Boolean),
      steps,
      canClose,
    }
  }

  if (hasAny && activeCount === entitlements.length) {
    steps[0]!.state = "complete"
    steps[1]!.state = "complete"
    steps[2]!.state = "complete"
    return {
      title: "All entitlements active",
      summary: "Every entitlement row is active. Inquiry should show Access granted.",
      nextSteps: ["Verify inquiry status is Access granted.", "Adjust or suspend individual entitlements if needed."],
      steps,
      canClose: false,
    }
  }

  steps[0]!.state = "current"
  return {
    title: formatInquiryStatus(status),
    summary: "Open entitlements below and complete the workflow for each asset type.",
    nextSteps: ["Generate or update entitlements, then activate."],
    steps,
    canClose,
  }
}

export function getContributorApplicationDetailGuidance(input: {
  inquiryStatus: string
}): InquiryGuidanceBlock & { steps: WorkflowStep[]; canClose: boolean } {
  const status = input.inquiryStatus.trim().toUpperCase()
  const canClose = canCloseInquiry(status)

  const steps: WorkflowStep[] = [
    {
      id: "review",
      label: "Review application",
      description: "Check name, contact, proposed username, and notes.",
      state: "upcoming",
    },
    {
      id: "approve",
      label: "Approve & issue credentials",
      description: "Creates portal username and one-time password (shown once).",
      state: "upcoming",
    },
    {
      id: "handoff",
      label: "Contributor sign-in",
      description: "Applicant uses the Contributor tab at /sign-in with issued credentials.",
      state: "upcoming",
    },
  ]

  if (status === "CLOSED") {
    for (const step of steps) step.state = "skipped"
    return {
      title: "Closed",
      summary: "Application closed without approval. No contributor portal credentials were issued.",
      nextSteps: ["Applicant may submit a new application later."],
      steps,
      canClose: false,
    }
  }

  if (status === "CONTRIBUTOR_APPROVED") {
    steps[0]!.state = "complete"
    steps[1]!.state = "complete"
    steps[2]!.state = "current"
    return {
      title: "Contributor approved",
      summary: "Portal credentials were issued. Share username and temporary password securely.",
      nextSteps: [
        "Confirm contributor profile status is ACTIVE.",
        "Applicant signs in at /sign-in → Contributor tab.",
      ],
      steps,
      canClose: false,
    }
  }

  steps[0]!.state = "current"
  steps[1]!.state = "upcoming"
  steps[2]!.state = "upcoming"
  return {
    title: "Pending application",
    summary:
      "Applicant record exists in INACTIVE state. Approving activates the contributor and issues login credentials.",
    nextSteps: [
      "Review proposed username (override if needed before approve).",
      "Approve to generate one-time password — copy it immediately.",
      canClose ? "Close inquiry to reject without issuing credentials." : "",
    ].filter(Boolean),
    steps,
    canClose,
  }
}

export function getDashboardPendingAccessHelp(pendingCount: number): string {
  if (pendingCount === 0) {
    return "No customer signups waiting. When someone registers, they appear here as Pending until entitlements are activated."
  }
  if (pendingCount === 1) {
    return "1 customer finished signup but cannot download yet. Open Access inquiries → Pending: Generate entitlement draft, set quotas, Activate."
  }
  return `${pendingCount} customers waiting. Pending means registered, not broken — open each inquiry, create drafts, then activate per asset type.`
}

export function getDashboardPendingContributorHelp(pendingCount: number): string {
  if (pendingCount === 0) {
    return "No contributor applications waiting. New submissions from /apply-contributor appear here as Pending."
  }
  if (pendingCount === 1) {
    return "1 application waiting. Open Access inquiries → Contributor applications → approve to issue portal login or close to reject."
  }
  return `${pendingCount} applications waiting. Pending = received, not approved. Open each row to approve (one-time password) or close.`
}
