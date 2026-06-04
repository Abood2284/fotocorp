"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  completePlatformPasswordReset,
  PlatformAuthApiError,
  requestPlatformPasswordReset,
  validatePlatformPasswordResetToken,
} from "@/lib/api/platform-auth-api"
import {
  PLATFORM_PASSWORD_MIN_LENGTH_MESSAGE,
  validatePlatformNewPassword,
} from "@/lib/platform-password-validation"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address.")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await requestPlatformPasswordReset(trimmed)
      setMessage(result.message)
      setEmail("")
    } catch (caught) {
      if (caught instanceof PlatformAuthApiError) setError(caught.message)
      else setError("We could not process your request. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthFormShell
      title="Forgot password"
      description="Enter the email on your Fotocorp account. We will send reset instructions if an account exists."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <label htmlFor="reset-email" className="text-sm font-bold text-foreground">
            Email
          </label>
          <Input
            id="reset-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="rounded-none border-border-strong"
          />
        </div>

        {error ? <FormAlert variant="error">{error}</FormAlert> : null}
        {message ? <FormAlert variant="success">{message}</FormAlert> : null}

        <Button type="submit" disabled={isSubmitting} className="w-full rounded-none">
          {isSubmitting ? "Sending..." : "Send reset link"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-bold text-foreground underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthFormShell>
  )
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter()
  const [tokenState, setTokenState] = useState<"checking" | "valid" | "invalid">("checking")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token?.trim()) {
      setTokenState("invalid")
      return
    }

    let cancelled = false
    validatePlatformPasswordResetToken(token)
      .then(() => {
        if (!cancelled) setTokenState("valid")
      })
      .catch(() => {
        if (!cancelled) setTokenState("invalid")
      })

    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token?.trim()) return

    setError(null)
    const validationError = validatePlatformNewPassword(newPassword, confirmPassword)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await completePlatformPasswordReset(token, newPassword)
      setMessage(result.message)
      setTimeout(() => router.push("/sign-in"), 1500)
    } catch (caught) {
      if (caught instanceof PlatformAuthApiError && caught.code === "INVALID_RESET_TOKEN") {
        setTokenState("invalid")
      } else if (caught instanceof PlatformAuthApiError && caught.code === "WEAK_PASSWORD") {
        setError(caught.message)
      } else if (caught instanceof PlatformAuthApiError) {
        setError(caught.message)
      } else {
        setError("We could not reset your password. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (tokenState === "checking") {
    return (
      <AuthFormShell title="Reset password" description="Checking your reset link…">
        <p className="text-sm text-muted-foreground">Please wait.</p>
      </AuthFormShell>
    )
  }

  if (tokenState === "invalid") {
    return (
      <AuthFormShell
        title="Reset link expired"
        description="This password reset link is invalid or has already been used."
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Request a new link from the forgot password page.
          </p>
          <Link
            href="/forgot-password"
            className="button-primary-square inline-flex h-10 w-full items-center justify-center text-sm font-bold"
          >
            Request new link
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/sign-in" className="font-bold text-foreground underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </AuthFormShell>
    )
  }

  return (
    <AuthFormShell
      title="Choose a new password"
      description="Set a new password for your Fotocorp account. You will need to sign in again on other devices."
    >
      {message ? (
        <FormAlert variant="success">{message}</FormAlert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <PasswordField id="new-password" label="New password" value={newPassword} onChange={setNewPassword} />
          <PasswordField
            id="confirm-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          <div className="border border-border bg-secondary/40 p-4 text-xs leading-5 text-muted-foreground">
            {PLATFORM_PASSWORD_MIN_LENGTH_MESSAGE}
          </div>

          {error ? <FormAlert variant="error">{error}</FormAlert> : null}

          <Button type="submit" disabled={isSubmitting} className="w-full rounded-none">
            {isSubmitting ? "Saving..." : "Reset password"}
          </Button>
        </form>
      )}
      {!message ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-bold text-foreground underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      ) : null}
    </AuthFormShell>
  )
}

function AuthFormShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-white text-foreground lg:grid lg:h-screen lg:grid-cols-[minmax(0,1.3fr)_minmax(420px,0.7fr)] lg:overflow-hidden">
      <section className="relative hidden min-h-screen overflow-hidden bg-primary lg:block lg:h-screen">
        <Image
          src="/images/auth_stock.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 65vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/30" />
        <Link
          href="/"
          className="fc-brand absolute left-8 top-7 text-[0.95rem] font-semibold uppercase tracking-[0.18em] text-white"
        >
          Fotocorp
        </Link>
      </section>

      <section className="flex min-h-screen flex-col bg-surface-warm lg:h-screen lg:overflow-y-auto lg:bg-white">
        <div className="flex items-center justify-between px-5 py-5 lg:hidden">
          <Link href="/" className="fc-brand text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
            Fotocorp
          </Link>
        </div>
        <div className="flex flex-1 flex-col px-5 pb-8 sm:px-8 lg:px-10 lg:pt-16">
          <div className="mx-auto w-full max-w-[520px] lg:max-w-md">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </section>
    </main>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
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
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="rounded-none border-border-strong"
      />
    </div>
  )
}

function FormAlert({ variant, children }: { variant: "error" | "success"; children: React.ReactNode }) {
  const className =
    variant === "error"
      ? "border border-destructive/30 bg-destructive-light px-3 py-2 text-sm text-destructive"
      : "border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
  return <p className={className}>{children}</p>
}
