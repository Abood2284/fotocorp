"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { changePlatformPassword, PlatformAuthApiError } from "@/lib/api/platform-auth-api"
import { validatePlatformNewPassword } from "@/lib/platform-password-validation"

export function ChangePlatformPasswordForm() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    const validationError = validatePlatformNewPassword(newPassword, confirmPassword)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      await changePlatformPassword(currentPassword, newPassword)
      setSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      router.refresh()
    } catch (caught) {
      if (caught instanceof PlatformAuthApiError && caught.code === "INVALID_CURRENT_PASSWORD") {
        setError("Current password is invalid.")
      } else if (caught instanceof PlatformAuthApiError && caught.code === "WEAK_PASSWORD") {
        setError(caught.message)
      } else if (caught instanceof PlatformAuthApiError && caught.code === "PASSWORD_UNCHANGED") {
        setError(caught.message)
      } else if (caught instanceof PlatformAuthApiError) {
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

      <div className="border border-border bg-secondary/40 p-4 text-xs leading-5 text-muted-foreground">
        Use at least 6 characters (same rule as registration). Other signed-in devices will be signed out after a
        successful change.
      </div>

      {error ? (
        <p className="border border-destructive/30 bg-destructive-light px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {success ? (
        <p className="border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">
          Your password was updated. You remain signed in on this device.
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="rounded-none">
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
      <label htmlFor={id} className="text-sm font-bold text-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="rounded-none border-border-strong"
      />
    </div>
  )
}
