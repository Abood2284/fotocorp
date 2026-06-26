"use client"

import { StaffApiError } from "@/lib/api/staff-api"

interface StaffHelpClientOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
}

export async function staffHelpClientJson<T>(path: string, options: StaffHelpClientOptions): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`
  const response = await fetch(`/api/staff/help${normalized}`, {
    method: options.method,
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    let code = "STAFF_HELP_API_ERROR"
    let message = "Help request failed."
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } }
      code = body.error?.code ?? code
      message = body.error?.message ?? message
    } catch {
      // ignore parse errors
    }
    throw new StaffApiError(response.status, code, message)
  }

  return response.json() as Promise<T>
}
