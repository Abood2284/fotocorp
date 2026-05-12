"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { changeContributorPassword, ContributorApiError } from "@/lib/api/contributor-api"

export function ChangeContributorPasswordForm() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const validationError = validatePassword(newPassword, confirmPassword)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      await changeContributorPassword(currentPassword, newPassword)
      router.push("/contributor/dashboard")
      router.refresh()
    } catch (caught) {
      if (caught instanceof ContributorApiError && caught.code === "INVALID_CURRENT_PASSWORD") {
        setError("Current password is invalid.")
      } else if (caught instanceof ContributorApiError && caught.code === "WEAK_PASSWORD") {
        setError(caught.message)
      } else {
        setError("We could not update your password. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PasswordField
        id="current-password"
        label="Current password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={setCurrentPassword}
      />
      <PasswordField
        id="new-password"
        label="New password"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
      />
      <PasswordField
        id="confirm-password"
        label="Confirm new password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
      />

      <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
        Use at least 12 characters with uppercase, lowercase, a number, and a symbol.
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive-light px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Updating..." : "Update password"}
      </Button>
    </form>
  )
}

function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
}: {
  id: string
  label: string
  autoComplete: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  )
}

function validatePassword(password: string, confirmation: string) {
  if (password.length < 12) return "New password must be at least 12 characters."
  if (!/[A-Z]/.test(password)) return "New password must include an uppercase letter."
  if (!/[a-z]/.test(password)) return "New password must include a lowercase letter."
  if (!/[0-9]/.test(password)) return "New password must include a number."
  if (!/[^A-Za-z0-9]/.test(password)) return "New password must include a symbol."
  if (password !== confirmation) return "New passwords do not match."
  return null
}
