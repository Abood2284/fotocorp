"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ContributorApplicationApiError,
  submitContributorApplication,
} from "@/lib/api/contributor-application-api"
import { isValidUsername, normalizeUsername } from "@/lib/username"

export function ContributorApplicationForm() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const form = new FormData(event.currentTarget)
    const firstName = String(form.get("firstName") ?? "").trim()
    const lastName = String(form.get("lastName") ?? "").trim()
    const proposedUsername = normalizeUsername(String(form.get("proposedUsername") ?? ""))
    const email = String(form.get("email") ?? "").trim()
    const phoneCountryCode = String(form.get("phoneCountryCode") ?? "").trim()
    const phoneNumber = String(form.get("phoneNumber") ?? "").trim()
    const applicationNotes = String(form.get("applicationNotes") ?? "").trim()

    if (!firstName || !lastName) {
      setError("First and last name are required.")
      return
    }
    if (!isValidUsername(proposedUsername)) {
      setError("Choose a username with 3–30 lowercase letters, numbers, dots, or underscores.")
      return
    }

    setSaving(true)
    try {
      await submitContributorApplication({
        firstName,
        lastName,
        proposedUsername,
        email: email || undefined,
        phoneCountryCode: phoneCountryCode || undefined,
        phoneNumber: phoneNumber || undefined,
        applicationNotes: applicationNotes || undefined,
      })
      setSubmitted(true)
    } catch (caught) {
      if (caught instanceof ContributorApplicationApiError) setError(caught.message)
      else setError("Something went wrong. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6">
        <h2 className="font-serif text-xl font-semibold text-foreground">Application received</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Thank you. Our team will review your contributor application and email you when your portal access is ready.
        </p>
        <Link href="/" className="mt-6 inline-flex text-sm font-medium text-primary hover:underline">
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">First name</span>
          <input
            name="firstName"
            required
            autoComplete="given-name"
            className="h-11 rounded-none border border-input bg-background px-3"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Last name</span>
          <input
            name="lastName"
            required
            autoComplete="family-name"
            className="h-11 rounded-none border border-input bg-background px-3"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Preferred username</span>
        <input
          name="proposedUsername"
          required
          autoComplete="username"
          className="h-11 rounded-none border border-input bg-background px-3"
          placeholder="e.g. jane.doe"
        />
        <span className="text-xs text-muted-foreground">You will sign in with this username once approved.</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Email (optional)</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="h-11 rounded-none border border-input bg-background px-3"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Country code</span>
          <input
            name="phoneCountryCode"
            inputMode="numeric"
            placeholder="91"
            className="h-11 rounded-none border border-input bg-background px-3"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Mobile number (optional)</span>
          <input
            name="phoneNumber"
            inputMode="tel"
            autoComplete="tel-national"
            className="h-11 rounded-none border border-input bg-background px-3"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">About your work (optional)</span>
        <textarea
          name="applicationNotes"
          rows={4}
          className="rounded-none border border-input bg-background px-3 py-2"
          placeholder="Portfolio links, specialties, or how you work with Fotocorp."
        />
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-11 items-center justify-center rounded-none bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {saving ? "Submitting…" : "Submit application"}
      </button>
    </form>
  )
}
