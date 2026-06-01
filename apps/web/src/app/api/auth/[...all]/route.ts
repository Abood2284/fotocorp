import { NextRequest } from "next/server"

/** Better Auth catch-all retired after P5 — use /api/auth/login, logout, sign-up, get-session. */
export function GET() {
  return retiredResponse()
}

export function POST() {
  return retiredResponse()
}

export function PUT() {
  return retiredResponse()
}

export function PATCH() {
  return retiredResponse()
}

export function DELETE() {
  return retiredResponse()
}

function retiredResponse() {
  return Response.json(
    {
      error: {
        code: "BETTER_AUTH_RETIRED",
        message:
          "This Better Auth route is no longer available. Use /api/auth/login, /api/auth/logout, /api/auth/sign-up, or /api/auth/get-session.",
      },
    },
    { status: 410 },
  )
}
