"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { FormEvent, useState, useTransition } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isValidUsername, normalizeUsername } from "@/lib/username"

export interface AuthFormProps {
  mode: AuthMode
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorMessage, setErrorMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const isSignUp = mode === "sign-up"
  const callbackUrl = searchParams.get("callbackUrl") || "/account"

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage("")

    const formData = new FormData(event.currentTarget)
    const username = normalizeUsername(String(formData.get("username") || ""))
    const identifier = String(formData.get("identifier") || "").trim()
    const email = String(formData.get("email") || "").trim()
    const password = String(formData.get("password") || "")

    if (!password) {
      setErrorMessage("Password is required.")
      return
    }

    if (isSignUp) {
      if (!email) {
        setErrorMessage("Email is required.")
        return
      }

      if (!isValidUsername(username)) {
        setErrorMessage("Username must be 3 to 30 characters and use only letters, numbers, underscores, or dots.")
        return
      }
    } else if (!identifier) {
      setErrorMessage("Email or username is required.")
      return
    }

    startTransition(async () => {
      const response = isSignUp
        ? await authClient.signUp.email({ email, name: username, username, password })
        : identifier.includes("@")
          ? await authClient.signIn.email({ email: identifier, password })
          : await authClient.signIn.username({ username: normalizeUsername(identifier), password })

      if (response.error) {
        setErrorMessage(getAuthErrorMessage(response.error))
        return
      }

      router.push(callbackUrl)
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="mb-8">
        <Link href="/" className="fc-label text-sm text-muted-foreground hover:text-foreground">
          Fotocorp
        </Link>
        <h1 className="mt-6 fc-display text-4xl tracking-tight text-foreground">
          {isSignUp ? "Create your account" : "Sign in to Fotocorp"}
        </h1>
        <p className="mt-3 fc-body text-muted-foreground">
          {isSignUp
            ? "Create a Fotocorp account with a username, email, and password."
            : "Access your protected Fotocorp workspace with your email or username."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp ? (
          <>
            <Field label="Username" name="username" type="text" autoComplete="username" placeholder="jane_editorial" />
            <Field label="Email" name="email" type="email" autoComplete="email" placeholder="jane@example.com" />
          </>
        ) : (
          <Field
            label="Email or username"
            name="identifier"
            type="text"
            autoComplete="username"
            placeholder="jane@example.com or jane_editorial"
          />
        )}

        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          placeholder="Enter your password"
        />

        {errorMessage ? (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-in?tab=register"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {isSignUp ? "Sign in" : "Create one"}
        </Link>
      </p>
    </div>
  )
}

function Field({ label, name, type, autoComplete, placeholder }: FieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Input
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className="h-12"
      />
    </label>
  )
}

function getAuthErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    const message = String(error.message || "")
    if (message) return message
  }

  return "Authentication failed. Please try again."
}

type AuthMode = "sign-in" | "sign-up"

interface FieldProps {
  label: string
  name: string
  type: string
  autoComplete: string
  placeholder: string
}
