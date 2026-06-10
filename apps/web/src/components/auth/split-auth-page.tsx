"use client"

import Image from "next/image"
import Link from "next/link"
import { FotocorpLogoLink } from "@/components/layout/fotocorp-logo-link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { all as allCountries } from "country-codes-list"
import { platformLogin, platformSignUp } from "@/lib/api/platform-auth-api"
import { loginStaff, StaffApiError } from "@/lib/api/staff-api"
import { stripLegacyPersonaFromSignInSearchParams } from "@/lib/auth-sign-in-gateway"
import {
  isPlatformAccessPendingReview,
  isPlatformInvalidCredentials,
  resolvePlatformPostLoginRedirect,
  resolveStaffPostLoginRedirectFromSignIn,
} from "@/lib/auth-post-login"
import { buildUnifiedSessionFromPlatform } from "@/lib/auth-session-build"
import { SHARED_AUTH_SESSION_QUERY_KEY } from "@/lib/use-shared-auth-session"
import { resolveAuthRedirectFromSearchParams } from "@/lib/auth-redirect"
import { isValidUsername, normalizeUsername } from "@/lib/username"
import { migrateAnonBoardsToServer } from "@/lib/storage/fotobox-anon-store"

type AuthTab = "sign-in" | "register"
type RegisterView = "choice" | "client-form"
type RegisterStep = 1 | 2 | 3
type FormErrors = Record<string, string>

interface SelectOption {
  label: string
  value: string
}

interface SelectGroup {
  label: string
  options: SelectOption[]
}

const COMPANY_TYPE_GROUPS: SelectGroup[] = [
  {
    label: "Agencies",
    options: [
      { label: "Creative Agency", value: "agency" },
      { label: "Media Agency", value: "media" },
      { label: "PR Agency", value: "agency" },
      { label: "Photo Agency", value: "photo_agency" },
    ],
  },
  {
    label: "Corporation / Business",
    options: [
      { label: "Automotive & Other Vehicles", value: "brand" },
      { label: "Business & Consumer Services", value: "brand" },
      { label: "Consumer Goods & Manufacturing", value: "brand" },
      { label: "Energy", value: "brand" },
      { label: "Entertainment & Art Services", value: "brand" },
      { label: "Fashion & Clothing", value: "brand" },
      { label: "Financial Services", value: "brand" },
      { label: "Food & Beverages", value: "brand" },
      { label: "Gaming & eSports", value: "brand" },
      { label: "Healthcare & Pharmaceuticals", value: "brand" },
      { label: "Industrial Manufacturing", value: "brand" },
      { label: "Property Management & Development", value: "brand" },
      { label: "Retail", value: "brand" },
      { label: "Software & Services", value: "brand" },
      { label: "Technology Hardware & Equipment", value: "brand" },
      { label: "Telecommunication Services", value: "brand" },
      { label: "Transport & Logistics", value: "brand" },
      { label: "Travel & Accommodation", value: "brand" },
      { label: "Utilities", value: "brand" },
      { label: "Unclassified Establishment", value: "other" },
    ],
  },
  {
    label: "Government, Education, Non-profit",
    options: [
      { label: "Education", value: "education" },
      { label: "Government", value: "government" },
      { label: "Non-profit or Cultural Institution", value: "non_profit" },
    ],
  },
  {
    label: "Media, News & Entertainment",
    options: [
      { label: "Publishing: Books", value: "publisher" },
      { label: "Publishing: Newspaper", value: "newsroom" },
      { label: "Publishing: Online", value: "publisher" },
      { label: "Publishing: Print & Online", value: "publisher" },
      { label: "Studio, Network or Digital Streaming Platform", value: "broadcaster" },
    ],
  },
  {
    label: "Production and Post Production",
    options: [
      { label: "Commercial Production", value: "other" },
      { label: "Corporate Communications", value: "other" },
      { label: "Editing & Post-Production", value: "other" },
      { label: "Production Company", value: "other" },
    ],
  },
  {
    label: "Other",
    options: [
      { label: "Self-employed", value: "other" },
      { label: "Other", value: "other" },
    ],
  },
]

const JOB_TITLE_GROUPS: SelectGroup[] = [
  {
    label: "Freelancer",
    options: [{ label: "Freelancer", value: "Freelancer" }],
  },
  {
    label: "Business/General",
    options: [
      { label: "Business Development", value: "Business Development" },
      { label: "Footage Librarian", value: "Footage Librarian" },
      { label: "Owner", value: "Owner" },
      { label: "Project Manager", value: "Project Manager" },
    ],
  },
  {
    label: "Production",
    options: [
      { label: "Associate Producer", value: "Associate Producer" },
      { label: "Clearance Coordinator", value: "Clearance Coordinator" },
      { label: "Creative Director", value: "Creative Director" },
      { label: "Director", value: "Director" },
      { label: "Editor (& Assistant Editor)", value: "Editor (& Assistant Editor)" },
      { label: "Executive Producer", value: "Executive Producer" },
      { label: "Head of Production", value: "Head of Production" },
      { label: "Post Production Supervisor", value: "Post Production Supervisor" },
      { label: "Producer", value: "Producer" },
      { label: "Production Assistant", value: "Production Assistant" },
    ],
  },
  {
    label: "Other",
    options: [{ label: "Other", value: "Other" }],
  },
]

const USERNAME_ERROR_MESSAGE = "Username can only use letters, numbers, dots, and underscores."
const PASSWORD_MIN_LENGTH = 6
const PASSWORD_HINT = `Use at least ${PASSWORD_MIN_LENGTH} characters.`
const PASSWORD_MIN_LENGTH_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`

const SIGN_IN_FIELD_ORDER = ["identifier", "password"] as const

const REGISTER_FIELD_ORDER = [
  "firstName",
  "lastName",
  "username",
  "companyType",
  "companyName",
  "jobTitle",
  "customJobTitle",
  "companyEmail",
  "interestedAssetTypes",
  "imageQuantityRange",
  "imageQualityPreference",
  "royaltyFreeQuantityRange",
  "royaltyFreeQualityPreference",
  "phoneCountryCode",
  "phoneNumber",
  "password",
] as const

function clearAuthFieldError(
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>,
  fieldName: string,
) {
  setErrors((current) => {
    if (!current[fieldName]) return current
    const next = { ...current }
    delete next[fieldName]
    return next
  })
}

function scrollFirstAuthFieldErrorIntoView(tab: AuthTab, errors: FormErrors) {
  const order = tab === "register" ? REGISTER_FIELD_ORDER : SIGN_IN_FIELD_ORDER
  const firstKey = order.find((key) => Boolean(errors[key]))
  if (!firstKey) return
  const root = document.querySelector(`[data-auth-form="${tab}"]`)
  const scope = root instanceof HTMLElement ? root : document.body
  const el = scope.querySelector(`[data-auth-field="${firstKey}"]`) as HTMLElement | null
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  const focusable = el.matches("input, select, textarea")
    ? el
    : (el.querySelector("input, select, textarea") as HTMLElement | null)
  if (focusable) focusable.focus({ preventScroll: true })
}

function queueScrollToFirstFieldError(tab: AuthTab, errors: FormErrors) {
  if (!Object.keys(errors).length) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => scrollFirstAuthFieldErrorIntoView(tab, errors))
  })
}

export function SplitAuthPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<AuthTab>(() => {
    const tab = searchParams.get("tab")
    return tab === "register" ? "register" : "sign-in"
  })
  const [registerView, setRegisterView] = useState<RegisterView>("choice")
  const [errors, setErrors] = useState<FormErrors>({})
  const [jobTitle, setJobTitle] = useState("")
  const [interest, setInterest] = useState({
    EDITORIAL: false,
    ROYALTY_FREE: false,
    VIDEO: false,
    CARICATURE: false,
  })
  const [notice, setNotice] = useState("")
  const [isPending, startTransition] = useTransition()
  const [registerStep, setRegisterStep] = useState<RegisterStep>(1)
  const registerFormRef = useRef<HTMLFormElement>(null)
  const callingCodes = useMemo(getCallingCodeOptions, [])

  const redirectTo = useMemo(() => resolveAuthRedirectFromSearchParams(searchParams), [searchParams])
  const callbackUrl = searchParams.get("callbackUrl")

  useEffect(() => {
    const nextPath = stripLegacyPersonaFromSignInSearchParams(searchParams)
    if (nextPath) router.replace(nextPath)
  }, [searchParams, router])

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "register") setActiveTab("register")
  }, [searchParams])

  function switchTab(tab: AuthTab) {
    setActiveTab(tab)
    setErrors({})
    setNotice("")
    setRegisterStep(1)
    setRegisterView("choice")
    if (tab === "sign-in") setInterest({ EDITORIAL: false, ROYALTY_FREE: false, VIDEO: false, CARICATURE: false })
  }

  function backToRegisterChoice() {
    setRegisterView("choice")
    setRegisterStep(1)
    setErrors({})
    setNotice("")
  }

  function clearFieldError(fieldName: string) {
    clearAuthFieldError(setErrors, fieldName)
    setNotice("")
  }

  function handleNextStep() {
    if (!registerFormRef.current) return
    const formData = new FormData(registerFormRef.current)
    const nextErrors: FormErrors = {}

    if (registerStep === 1) {
      requireField(formData, nextErrors, "firstName", "First name is required.")
      requireField(formData, nextErrors, "lastName", "Last name is required.")
      const username = normalizeUsername(String(formData.get("username") ?? ""))
      if (!username) {
        nextErrors.username = "Username is required."
      } else if (!isValidUsername(username)) {
        nextErrors.username = USERNAME_ERROR_MESSAGE
      }
      const email = String(formData.get("companyEmail") ?? "").trim()
      if (!email) {
        nextErrors.companyEmail = "Company email is required."
      } else if (!isBasicEmail(email)) {
        nextErrors.companyEmail = "Enter a valid company email."
      }
      const password = String(formData.get("password") ?? "")
      if (!password) {
        nextErrors.password = "Password is required."
      } else if (password.length < PASSWORD_MIN_LENGTH) {
        nextErrors.password = PASSWORD_MIN_LENGTH_MESSAGE
      }
    } else if (registerStep === 2) {
      requireField(formData, nextErrors, "companyType", "Company type is required.")
      requireField(formData, nextErrors, "companyName", "Company name is required.")
      requireField(formData, nextErrors, "jobTitle", "Job title is required.")
      if (String(formData.get("jobTitle") ?? "") === "Other") {
        requireField(formData, nextErrors, "customJobTitle", "Job title is required.")
      }
      requireField(formData, nextErrors, "phoneCountryCode", "Phone country code is required.")
      requireField(formData, nextErrors, "phoneNumber", "Telephone is required.")
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      queueScrollToFirstFieldError("register", nextErrors)
      return
    }
    setRegisterStep((s) => (s + 1) as RegisterStep)
  }

  function handlePrevStep() {
    setRegisterStep((s) => (s - 1) as RegisterStep)
    setErrors({})
    setNotice("")
  }

  function handleRegisterFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (registerStep < 3) {
      event.preventDefault()
      handleNextStep()
    } else {
      handleRegister(event)
    }
  }

  function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice("")
    const formData = new FormData(event.currentTarget)
    const nextErrors: FormErrors = {}
    const identifier = String(formData.get("identifier") ?? "").trim()
    const password = String(formData.get("password") ?? "")

    if (!identifier) nextErrors.identifier = "Email or username is required."
    if (!password) nextErrors.password = "Password is required."

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      queueScrollToFirstFieldError("sign-in", nextErrors)
      return
    }

    startTransition(async () => {
      const loginIdentifier = identifier.includes("@") ? identifier : normalizeUsername(identifier)

      try {
        const response = await platformLogin(loginIdentifier, password, { scope: "ANY" })

        if (!response.error) {
          await fetch("/api/staff/auth/logout", { method: "POST", credentials: "include" }).catch(() => null)

          const ownerType = response.ownerType === "CONTRIBUTOR" ? "CONTRIBUTOR" : "USER"

          const unified = buildUnifiedSessionFromPlatform({
            ownerType,
            user: response.user
              ? {
                  id: response.user.id,
                  email: response.user.email,
                  displayName: response.user.displayName ?? null,
                  username: response.user.username ?? null,
                }
              : null,
            contributor: response.contributor
              ? {
                  id: response.contributor.id,
                  displayName: response.contributor.displayName,
                  username: response.contributor.username,
                  email: response.contributor.email ?? null,
                }
              : null,
          })

          if (unified) {
            queryClient.setQueryData(SHARED_AUTH_SESSION_QUERY_KEY, unified)
          } else {
            await queryClient.invalidateQueries({ queryKey: SHARED_AUTH_SESSION_QUERY_KEY })
          }

          if (ownerType === "USER") {
            await migrateAnonBoardsToServer()
          }

          router.push(
            resolvePlatformPostLoginRedirect(ownerType, callbackUrl, {
              accessInquiryStatus: response.accessInquiry?.status ?? null,
            }),
          )
          router.refresh()
          return
        }

        if (isPlatformAccessPendingReview(response.error)) {
          applySignInServerError({ error: response.error, setErrors, setNotice, tab: "sign-in" })
          return
        }

        if (!isPlatformInvalidCredentials(response.error)) {
          applySignInServerError({ error: response.error, setErrors, setNotice, tab: "sign-in" })
          return
        }
      } catch (error) {
        applySignInServerError({ error, setErrors, setNotice, tab: "sign-in" })
        return
      }

      try {
        const me = await loginStaff(identifier, password)
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null)
        await queryClient.invalidateQueries({ queryKey: SHARED_AUTH_SESSION_QUERY_KEY })
        const next = resolveStaffPostLoginRedirectFromSignIn(me.staff.role, callbackUrl)
        router.push(next)
        router.refresh()
      } catch (caught) {
        if (caught instanceof StaffApiError && caught.status >= 500) {
          setNotice("We could not sign you in right now. Please try again.")
        } else {
          setErrors({ password: "Invalid email, username, or password." })
        }
      }
    })
  }

  function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice("")
    const formData = new FormData(event.currentTarget)
    const nextErrors: FormErrors = {}

    requireField(formData, nextErrors, "firstName", "First name is required.")
    requireField(formData, nextErrors, "lastName", "Last name is required.")
    requireField(formData, nextErrors, "companyType", "Company type is required.")
    requireField(formData, nextErrors, "companyName", "Company name is required.")
    requireField(formData, nextErrors, "jobTitle", "Job title is required.")
    requireField(formData, nextErrors, "phoneCountryCode", "Phone country code is required.")
    requireField(formData, nextErrors, "phoneNumber", "Telephone is required.")
    const password = String(formData.get("password") ?? "")
    if (!password) {
      nextErrors.password = "Password is required."
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      nextErrors.password = PASSWORD_MIN_LENGTH_MESSAGE
    }

    const username = normalizeUsername(String(formData.get("username") ?? ""))
    if (!username) {
      nextErrors.username = "Username is required."
    } else if (!isValidUsername(username)) {
      nextErrors.username = USERNAME_ERROR_MESSAGE
    }

    const email = String(formData.get("companyEmail") ?? "").trim()
    if (!email) {
      nextErrors.companyEmail = "Company email is required."
    } else if (!isBasicEmail(email)) {
      nextErrors.companyEmail = "Enter a valid company email."
    }

    const selectedJobTitle = String(formData.get("jobTitle") ?? "")
    if (selectedJobTitle === "Other") {
      requireField(formData, nextErrors, "customJobTitle", "Job title is required.")
    }

    const interestedAssetTypes = (["EDITORIAL", "ROYALTY_FREE", "VIDEO", "CARICATURE"] as const).filter(
      (k) => interest[k],
    )
    if (!interestedAssetTypes.length) {
      nextErrors.interestedAssetTypes = "Select at least one content type you are interested in."
    }
    if (interestedAssetTypes.includes("EDITORIAL")) {
      requireField(
        formData,
        nextErrors,
        "imageQuantityRange",
        "Editorial quantity range is required when Editorial is selected.",
      )
      requireField(
        formData,
        nextErrors,
        "imageQualityPreference",
        "Editorial quality preference is required when Editorial is selected.",
      )
    }
    if (interestedAssetTypes.includes("ROYALTY_FREE")) {
      requireField(
        formData,
        nextErrors,
        "royaltyFreeQuantityRange",
        "Royalty Free quantity range is required when Royalty Free is selected.",
      )
      requireField(
        formData,
        nextErrors,
        "royaltyFreeQualityPreference",
        "Royalty Free quality preference is required when Royalty Free is selected.",
      )
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      queueScrollToFirstFieldError("register", nextErrors)
      return
    }

    const firstName = String(formData.get("firstName") ?? "").trim()
    const lastName = String(formData.get("lastName") ?? "").trim()
    const companyType = String(formData.get("companyType") ?? "").trim()
    const companyName = String(formData.get("companyName") ?? "").trim()
    const customJobTitle = String(formData.get("customJobTitle") ?? "").trim()
    const phoneCountryCode = String(formData.get("phoneCountryCode") ?? "").trim()
    const phoneNumber = String(formData.get("phoneNumber") ?? "").trim()

    startTransition(async () => {
      const signUpPayload: Record<string, unknown> = {
        email,
        name: `${firstName} ${lastName}`.trim(),
        password,
        username,
        firstName,
        lastName,
        companyType,
        companyName,
        jobTitle: selectedJobTitle,
        customJobTitle: selectedJobTitle === "Other" ? customJobTitle : "",
        companyEmail: email,
        phoneCountryCode,
        phoneNumber,
        interestedAssetTypes,
      }
      if (interestedAssetTypes.includes("EDITORIAL")) {
        signUpPayload.imageQuantityRange = String(formData.get("imageQuantityRange") ?? "").trim()
        signUpPayload.imageQualityPreference = String(formData.get("imageQualityPreference") ?? "").trim()
      }
      if (interestedAssetTypes.includes("ROYALTY_FREE")) {
        signUpPayload.royaltyFreeQuantityRange = String(formData.get("royaltyFreeQuantityRange") ?? "").trim()
        signUpPayload.royaltyFreeQualityPreference = String(
          formData.get("royaltyFreeQualityPreference") ?? "",
        ).trim()
      }

      try {
        const response = await platformSignUp(signUpPayload)
        if (response.error) {
          applyRegisterServerError({ error: response.error, setErrors, setNotice, tab: "register" })
          return
        }

        await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null)
        queryClient.setQueryData(SHARED_AUTH_SESSION_QUERY_KEY, null)
      } catch (error) {
        applyRegisterServerError({ error, setErrors, setNotice, tab: "register" })
        return
      }

      router.push("/account/access-pending")
      router.refresh()
    })
  }

  return (
    <main className="relative min-h-screen text-white">
      {/* Background — full-viewport image, calmed + darkened */}
      <div aria-hidden="true" className="fixed inset-0 overflow-hidden bg-black">
        <Image
          src="/images/auth_stock.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-[1.02] object-cover filter-[brightness(0.45)_contrast(0.95)_saturate(0.85)_blur(1px)]"
        />
        <div className="absolute inset-0 bg-black/35" />
        {/* Radial teal glow behind the card */}
        <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_45%,rgba(0,170,185,0.18),transparent_45%)] lg:[background:radial-gradient(circle_at_72%_50%,rgba(0,170,185,0.18),transparent_45%)]" />
      </div>

      {/* Trust layer — bottom-left over the image, desktop only */}
      <div className="pointer-events-none fixed bottom-10 left-10 z-0 hidden max-w-md select-none lg:block">
        <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-white/50!">
          1M+ editorial images · News • Entertainment • Sports • Archives
        </p>
        <p className="text-3xl font-semibold leading-snug text-white!">
          Exceptional imagery.<br />Exclusively licensed.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/60!">
          India&apos;s editorial archive for news, entertainment, sports,
          royalty-free and historical coverage.
        </p>
      </div>

      {/* Glass auth card — centered on mobile, slightly right of center on desktop */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 lg:justify-end lg:pr-[10vw]">
        <section
          className="w-full max-w-[460px] rounded-[28px] border border-(--auth-glass-border) p-7 shadow-[0_30px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-[22px] backdrop-saturate-[1.35] [background:linear-gradient(145deg,rgba(14,18,22,0.78),rgba(8,10,13,0.62))] scheme-dark sm:min-h-[560px] sm:p-[42px]"
        >
          <div className="mb-7">
            <FotocorpLogoLink imageClassName="h-8 brightness-0 invert" priority />
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">
              {activeTab === "sign-in" ? "Welcome back" : "Create access request"}
            </h1>
            <p className="mt-1.5 text-sm text-white/60!">
              {activeTab === "sign-in"
                ? "Access India\u2019s editorial photo archive."
                : "Apply as a contributor or request buyer access."}
            </p>
          </div>

          <div className="mb-6 flex rounded-full border border-white/14 bg-white/8 p-1">
            <TabButton active={activeTab === "sign-in"} onClick={() => switchTab("sign-in")}>
              Sign In
            </TabButton>
            <TabButton active={activeTab === "register"} onClick={() => switchTab("register")}>
              Register
            </TabButton>
          </div>

          {activeTab === "sign-in" ? (
            <form data-auth-form="sign-in" onSubmit={handleSignIn} noValidate className="space-y-5">
              <TextField
                label="Email or username"
                name="identifier"
                autoComplete="username"
                error={errors.identifier}
                required
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                error={errors.password}
                required
              />

              <div className="flex items-center justify-between gap-4 pt-1">
                <Link
                  href="/forgot-password"
                  className="fc-label text-xs text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <SubmitButton disabled={isPending}>
                {isPending ? "Signing In..." : "Sign In"}
              </SubmitButton>
              <p className="text-center text-sm text-white/55!">
                New to Fotocorp?{" "}
                <Link href="/apply-contributor" className="font-medium text-white underline-offset-4 hover:underline">
                  Apply as a contributor
                </Link>
              </p>
              <FormNotice isError>{notice}</FormNotice>
            </form>
          ) : registerView === "choice" ? (
            <div className="space-y-4">
              <Link href="/apply-contributor" className={registerChoiceCardClassName}>
                <span className="block text-base font-semibold text-white">
                  I want to contribute photos
                </span>
                <span className="mt-1 block text-sm text-white/55">
                  Apply as Contributor →
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setRegisterView("client-form")}
                className={registerChoiceCardClassName}
              >
                <span className="block text-base font-semibold text-white">
                  I want to license/download photos
                </span>
                <span className="mt-1 block text-sm text-white/55">
                  Request Client Access →
                </span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={backToRegisterChoice}
                className="mb-5 text-sm text-white/60 transition-colors hover:text-white"
              >
                ← Back to options
              </button>

              <RegisterStepIndicator currentStep={registerStep} />

              <form
                    ref={registerFormRef}
                    data-auth-form="register"
                    onSubmit={handleRegisterFormSubmit}
                    noValidate
                  >
                    {/* ── Step 1: Your Info ── */}
                    <div className={registerStep !== 1 ? "hidden" : "space-y-4 pb-2"}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField
                          label="First Name"
                          name="firstName"
                          autoComplete="given-name"
                          error={errors.firstName}
                          onFieldChange={() => clearFieldError("firstName")}
                          required
                        />
                        <TextField
                          label="Last Name"
                          name="lastName"
                          autoComplete="family-name"
                          error={errors.lastName}
                          onFieldChange={() => clearFieldError("lastName")}
                          required
                        />
                      </div>
                      <TextField
                        label="Username"
                        name="username"
                        autoComplete="username"
                        error={errors.username}
                        onFieldChange={() => clearFieldError("username")}
                        required
                      />
                      <TextField
                        label="Company Email"
                        name="companyEmail"
                        type="email"
                        autoComplete="email"
                        error={errors.companyEmail}
                        onFieldChange={() => clearFieldError("companyEmail")}
                        required
                      />
                      <TextField
                        label="Password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        hint={PASSWORD_HINT}
                        error={errors.password}
                        onFieldChange={() => clearFieldError("password")}
                        required
                      />
                    </div>

                    {/* ── Step 2: Company ── */}
                    <div className={registerStep !== 2 ? "hidden" : "space-y-4 pb-2"}>
                      <SelectField
                        label="Company Type"
                        name="companyType"
                        groups={COMPANY_TYPE_GROUPS}
                        error={errors.companyType}
                        onFieldChange={() => clearFieldError("companyType")}
                        required
                      />
                      <TextField
                        label="Company Name"
                        name="companyName"
                        autoComplete="organization"
                        error={errors.companyName}
                        onFieldChange={() => clearFieldError("companyName")}
                        required
                      />
                      <SelectField
                        label="Job Title"
                        name="jobTitle"
                        groups={JOB_TITLE_GROUPS}
                        value={jobTitle}
                        onChange={(value) => {
                          setJobTitle(value)
                          clearFieldError("jobTitle")
                        }}
                        error={errors.jobTitle}
                        required
                      />
                      {jobTitle === "Other" ? (
                        <TextField
                          label="Job title"
                          name="customJobTitle"
                          autoComplete="organization-title"
                          error={errors.customJobTitle}
                          onFieldChange={() => clearFieldError("customJobTitle")}
                          required
                        />
                      ) : null}
                      <div className="grid gap-4 sm:grid-cols-[132px_minmax(0,1fr)]">
                        <label data-auth-field="phoneCountryCode" className="block space-y-2">
                          <span className={labelClassName}>Telephone *</span>
                          <select name="phoneCountryCode" defaultValue="+91" className={inputClassName}>
                            {callingCodes.map((country) => (
                              <option key={`${country.iso2}-${country.callingCode}`} value={country.callingCode}>
                                {country.iso2} {country.callingCode}
                              </option>
                            ))}
                          </select>
                          <FieldError>{errors.phoneCountryCode}</FieldError>
                        </label>
                        <TextField
                          label="Phone Number"
                          name="phoneNumber"
                          type="tel"
                          autoComplete="tel-national"
                          error={errors.phoneNumber}
                          onFieldChange={() => clearFieldError("phoneNumber")}
                          required
                        />
                      </div>
                    </div>

                    {/* ── Step 3: Interests ── */}
                    <div className={registerStep !== 3 ? "hidden" : "space-y-4 pb-2"}>
                      <fieldset
                        data-auth-field="interestedAssetTypes"
                        className="@container/interest space-y-3 rounded-[14px] border border-white/14 p-4"
                      >
                        <legend className={`${labelClassName} px-0.5`}>Tell us what you need *</legend>
                        <div className="flex flex-col gap-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={interest.EDITORIAL}
                              onChange={(e) => {
                                setInterest((s) => ({ ...s, EDITORIAL: e.target.checked }))
                                clearFieldError("interestedAssetTypes")
                              }}
                              className="h-4 w-4 rounded accent-(--auth-teal)"
                            />
                            Editorial
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={interest.ROYALTY_FREE}
                              onChange={(e) => {
                                setInterest((s) => ({ ...s, ROYALTY_FREE: e.target.checked }))
                                clearFieldError("interestedAssetTypes")
                              }}
                              className="h-4 w-4 rounded accent-(--auth-teal)"
                            />
                            Royalty Free
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={interest.VIDEO}
                              onChange={(e) => {
                                setInterest((s) => ({ ...s, VIDEO: e.target.checked }))
                                clearFieldError("interestedAssetTypes")
                              }}
                              className="h-4 w-4 rounded accent-(--auth-teal)"
                            />
                            Videos
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={interest.CARICATURE}
                              onChange={(e) => {
                                setInterest((s) => ({ ...s, CARICATURE: e.target.checked }))
                                clearFieldError("interestedAssetTypes")
                              }}
                              className="h-4 w-4 rounded accent-(--auth-teal)"
                            />
                            Caricatures
                          </label>
                        </div>
                        <FieldError>{errors.interestedAssetTypes}</FieldError>
                        {interest.EDITORIAL ? (
                          <InterestPreferenceFields
                            assetLabel="Editorial"
                            quantityName="imageQuantityRange"
                            qualityName="imageQualityPreference"
                            quantityError={errors.imageQuantityRange}
                            qualityError={errors.imageQualityPreference}
                          />
                        ) : null}
                        {interest.ROYALTY_FREE ? (
                          <InterestPreferenceFields
                            assetLabel="Royalty Free"
                            quantityName="royaltyFreeQuantityRange"
                            qualityName="royaltyFreeQualityPreference"
                            quantityError={errors.royaltyFreeQuantityRange}
                            qualityError={errors.royaltyFreeQualityPreference}
                          />
                        ) : null}
                      </fieldset>
                    </div>

                    {/* ── Step navigation ── */}
                    <div className="mt-6 space-y-3">
                      {registerStep < 3 ? (
                        <button
                          type="submit"
                          className={primaryButtonClassName}
                        >
                          Continue
                        </button>
                      ) : (
                        <SubmitButton disabled={isPending}>
                          {isPending ? "Creating Account..." : "Create Account"}
                        </SubmitButton>
                      )}
                      {registerStep > 1 ? (
                        <button
                          type="button"
                          onClick={handlePrevStep}
                          className="w-full py-1 text-center text-sm text-white/60 transition-colors hover:text-white"
                        >
                          ← Back
                        </button>
                      ) : null}
                    </div>

                    <FormNotice isError>{notice}</FormNotice>
                  </form>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const REGISTER_STEPS: { n: RegisterStep; label: string }[] = [
  { n: 1, label: "Your Info" },
  { n: 2, label: "Company" },
  { n: 3, label: "Interests" },
]

function RegisterStepIndicator({ currentStep }: { currentStep: RegisterStep }) {
  return (
    <div className="mb-7">
      <div className="flex items-start">
        {REGISTER_STEPS.map((step, i) => (
          <div key={step.n} className="flex flex-1 items-start">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                  currentStep > step.n
                    ? "border-(--auth-teal) bg-(--auth-teal) text-(--auth-teal-deep)"
                    : currentStep === step.n
                      ? "border-(--auth-teal) text-(--auth-teal)"
                      : "border-white/30 text-white/50"
                }`}
              >
                {currentStep > step.n ? <CheckIcon /> : step.n}
              </div>
              <span
                className={`text-[10px] uppercase tracking-[0.12em] ${
                  currentStep === step.n ? "font-semibold text-white" : "text-white/50"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < REGISTER_STEPS.length - 1 ? (
              <div
                className={`mt-3.5 mx-1.5 h-px flex-1 transition-colors ${
                  currentStep > step.n ? "bg-(--auth-teal)" : "bg-white/15"
                }`}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function TabButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-full px-2 py-2.5 text-center text-sm font-semibold transition-all ${
        active
          ? "bg-white/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_18px_rgba(0,168,181,0.28)]"
          : "text-white/55 hover:text-white/80"
      }`}
    >
      {children}
    </button>
  )
}

interface TextFieldProps {
  label: string
  name: string
  type?: string
  autoComplete?: string
  hint?: string
  error?: string
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onFieldChange?: () => void
  required?: boolean
}

function TextField({
  label,
  name,
  type = "text",
  autoComplete,
  hint,
  error,
  value,
  onChange,
  onBlur,
  onFieldChange,
  required = false,
}: TextFieldProps) {
  const hintId = hint ? `${name}-hint` : undefined
  const errorId = error ? `${name}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined

  return (
    <label data-auth-field={name} className="block space-y-1.5">
      <span className={labelClassName}>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        className={error ? inputErrorClassName : inputClassName}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        value={value}
        onChange={(event) => {
          onFieldChange?.()
          onChange?.(event.target.value)
        }}
        onBlur={onBlur}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-white/50!">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId}>{error}</FieldError>
    </label>
  )
}

function SelectField({
  label,
  name,
  groups,
  value,
  onChange,
  error,
  onFieldChange,
  required = false,
}: {
  label: string
  name: string
  groups: SelectGroup[]
  value?: string
  onChange?: (value: string) => void
  error?: string
  onFieldChange?: () => void
  required?: boolean
}) {
  const errorId = error ? `${name}-error` : undefined

  return (
    <label data-auth-field={name} className="block space-y-1.5">
      <span className={labelClassName}>
        {label}
        {required ? " *" : ""}
      </span>
      <select
        name={name}
        value={value}
        onChange={(event) => {
          onFieldChange?.()
          onChange?.(event.target.value)
        }}
        className={error ? inputErrorClassName : inputClassName}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
      >
        <option value="">Select</option>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={`${group.label}-${option.label}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <FieldError id={errorId}>{error}</FieldError>
    </label>
  )
}

function FieldError({ children, id }: { children?: string; id?: string }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="text-xs leading-snug text-red-300!">
      {children}
    </p>
  )
}

function FormNotice({
  children,
  isError = false,
}: {
  children?: string
  isError?: boolean
}) {
  if (!children) return null
  const className = isError
    ? "border-red-400/40 bg-red-500/15 text-red-200!"
    : "border-white/20 bg-white/8 text-white/70!"
  return <p className={`rounded-[14px] border px-4 py-3 text-xs font-medium ${className}`}>{children}</p>
}

function SubmitButton({
  children,
  disabled = false,
}: {
  children: string
  disabled?: boolean
}) {
  return (
    <button type="submit" disabled={disabled} className={`mt-2 ${primaryButtonClassName}`}>
      {children}
    </button>
  )
}

function requireField(formData: FormData, errors: FormErrors, name: string, message: string) {
  if (!String(formData.get(name) ?? "").trim()) errors[name] = message
}

function isBasicEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getCallingCodeOptions() {
  const uniqueByIsoAndCode = new Map<string, { iso2: string; name: string; callingCode: string }>()

  for (const country of allCountries()) {
    if (!country.countryCallingCode) continue

    const option = {
      iso2: country.countryCode,
      name: country.countryNameEn,
      callingCode: `+${country.countryCallingCode}`,
    }
    const key = `${option.iso2}-${option.callingCode}`
    if (!uniqueByIsoAndCode.has(key)) uniqueByIsoAndCode.set(key, option)
  }

  return Array.from(uniqueByIsoAndCode.values())
    .sort((a, b) => {
      const priority = priorityScore(a.iso2) - priorityScore(b.iso2)
      return priority || a.name.localeCompare(b.name)
    })
}

function priorityScore(iso2: string) {
  return iso2 === "IN" ? 0 : iso2 === "US" ? 1 : iso2 === "GB" ? 2 : 10
}

function humanizeAuthErrorMessage(error: unknown, mode: AuthTab) {
  const errorCode = readErrorCode(error).toLowerCase()
  const errorStatus = readErrorStatus(error)
  const backendMessage = readErrorMessage(error)

  if (errorCode === "access_pending_review") {
    return "Your access request is still under review. We will email you when your account is approved."
  }
  if (errorCode === "username_is_already_taken") return "This username is already taken."
  if (errorCode === "user_already_exists") {
    return "An account with this email or username already exists."
  }
  if (errorCode === "user_already_exists_use_another_email") return "An account with this email already exists."
  if (errorCode === "invalid_username") return USERNAME_ERROR_MESSAGE
  if (errorCode === "missing_or_null_origin") return "Authentication request is invalid. Please refresh and try again."
  if (errorCode.includes("email")) return "Please check your company email and try again."

  if (backendMessage) {
    const rawMessage = backendMessage.trim()
    const message = rawMessage.toLowerCase()

    if (
      message.includes("invalid credential") ||
      message.includes("invalid username or password") ||
      message.includes("invalid email or password")
    ) {
      return "Invalid credentials. Please check your username or email and password."
    }
    if (message.includes("invalid username")) return USERNAME_ERROR_MESSAGE
    if (message.includes("already") && message.includes("email")) return "An account with this email already exists."
    if (message.includes("already") && message.includes("username")) return "This username is already taken."
    if ((message.includes("failed to fetch") || message.includes("network")) && !errorStatus) {
      return "Could not reach authentication service. Please check your connection and try again."
    }
    if (rawMessage) return rawMessage
  }

  if (errorStatus && errorStatus >= 400 && errorStatus < 500) {
    return mode === "sign-in"
      ? "Sign in failed. Please check your credentials and try again."
      : "Registration failed. Please review your details and try again."
  }

  return mode === "sign-in"
    ? "Authentication failed. Please try again."
    : "Registration failed. Please try again."
}

function applyRegisterServerError({
  error,
  setErrors,
  setNotice,
  tab,
}: {
  error: unknown
  setErrors: (errors: FormErrors) => void
  setNotice: (notice: string) => void
  tab: AuthTab
}) {
  const duplicateErrors = buildRegisterDuplicateErrors(error)
  if (Object.keys(duplicateErrors).length) {
    setErrors(duplicateErrors)
    queueScrollToFirstFieldError(tab, duplicateErrors)
    setNotice("")
    return
  }

  const fieldErrors = buildRegisterFieldErrors(error)
  if (Object.keys(fieldErrors).length) {
    setErrors(fieldErrors)
    queueScrollToFirstFieldError(tab, fieldErrors)
    setNotice("")
    return
  }

  const message = humanizeAuthErrorMessage(error, "register")
  const fieldName = mapRegisterServerErrorToField(error, message)
  if (fieldName) {
    const next = { [fieldName]: message }
    setErrors(next)
    queueScrollToFirstFieldError(tab, next)
    setNotice("")
    return
  }

  setErrors({})
  setNotice(message)
}

function applySignInServerError({
  error,
  setErrors,
  setNotice,
  tab,
}: {
  error: unknown
  setErrors: (errors: FormErrors) => void
  setNotice: (notice: string) => void
  tab: AuthTab
}) {
  const message = humanizeAuthErrorMessage(error, "sign-in")
  const fieldName = mapSignInServerErrorToField(error, message)
  if (fieldName) {
    const next = { [fieldName]: message }
    setErrors(next)
    queueScrollToFirstFieldError(tab, next)
  }
  setNotice(message)
}

function buildRegisterFieldErrors(error: unknown): FormErrors {
  const issues = readValidationIssues(error)
  const fieldErrors: FormErrors = {}

  for (const issue of issues) {
    const fieldName = mapRegisterApiPathToField(issue.path)
    if (!fieldName) continue
    const message = formatRegisterIssueMessage(fieldName, issue.message)
    if (!fieldErrors[fieldName]) fieldErrors[fieldName] = message
  }

  return fieldErrors
}

function readValidationIssues(error: unknown) {
  const detail = getNestedValue(error, "detail")
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return []

  const issues = (detail as { issues?: unknown }).issues
  if (!Array.isArray(issues)) return []

  return issues
    .map((issue) => {
      if (!issue || typeof issue !== "object") return null
      const path = "path" in issue ? String(issue.path ?? "") : ""
      const message = "message" in issue ? String(issue.message ?? "") : ""
      if (!path || !message) return null
      return { path, message }
    })
    .filter((issue): issue is { path: string; message: string } => Boolean(issue))
}

function mapRegisterApiPathToField(path: string): string | null {
  const normalized = path.trim().toLowerCase()
  if (normalized === "password") return "password"
  if (normalized === "email" || normalized === "companyemail") return "companyEmail"
  if (normalized === "username") return "username"
  if (normalized === "firstname") return "firstName"
  if (normalized === "lastname") return "lastName"
  if (normalized === "companytype") return "companyType"
  if (normalized === "companyname") return "companyName"
  if (normalized === "jobtitle") return "jobTitle"
  if (normalized === "customjobtitle") return "customJobTitle"
  if (normalized === "phonecountrycode") return "phoneCountryCode"
  if (normalized === "phonenumber") return "phoneNumber"
  if (normalized === "interestedassettypes") return "interestedAssetTypes"
  if (normalized === "imagequantityrange") return "imageQuantityRange"
  if (normalized === "imagequalitypreference") return "imageQualityPreference"
  if (normalized === "royaltyfreequantityrange") return "royaltyFreeQuantityRange"
  if (normalized === "royaltyfreequalitypreference") return "royaltyFreeQualityPreference"
  return null
}

function buildRegisterDuplicateErrors(error: unknown): FormErrors {
  const errorCode = readErrorCode(error).toLowerCase()
  if (errorCode !== "user_already_exists" && errorCode !== "user_already_exists_use_another_email") {
    return {}
  }

  const message = humanizeAuthErrorMessage(error, "register")
  return {
    companyEmail: message,
    username: "This username may already be taken. Try another.",
  }
}

function formatRegisterIssueMessage(fieldName: string, message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes("too small") || normalized.includes("at least")) {
    if (fieldName === "password") return PASSWORD_MIN_LENGTH_MESSAGE
    if (fieldName === "username") return "Username must be at least 3 characters."
  }

  if (normalized.includes("too big") || normalized.includes("at most")) {
    if (fieldName === "username") return "Username must be 30 characters or fewer."
  }

  if (normalized.includes("invalid") && (fieldName === "companyEmail" || fieldName === "email")) {
    return "Enter a valid company email."
  }

  if (normalized.includes("required") || normalized.includes("expected")) {
    return registerRequiredMessage(fieldName)
  }

  if (fieldName === "password" && normalized.includes("too small")) return PASSWORD_MIN_LENGTH_MESSAGE

  return message
}

function registerRequiredMessage(fieldName: string) {
  switch (fieldName) {
    case "firstName":
      return "First name is required."
    case "lastName":
      return "Last name is required."
    case "username":
      return "Username is required."
    case "companyType":
      return "Company type is required."
    case "companyName":
      return "Company name is required."
    case "jobTitle":
      return "Job title is required."
    case "customJobTitle":
      return "Job title is required."
    case "companyEmail":
      return "Company email is required."
    case "phoneCountryCode":
      return "Phone country code is required."
    case "phoneNumber":
      return "Telephone is required."
    case "password":
      return "Password is required."
    case "interestedAssetTypes":
      return "Select at least one content type you are interested in."
    case "imageQuantityRange":
      return "Editorial quantity range is required when Editorial is selected."
    case "imageQualityPreference":
      return "Editorial quality preference is required when Editorial is selected."
    case "royaltyFreeQuantityRange":
      return "Royalty Free quantity range is required when Royalty Free is selected."
    case "royaltyFreeQualityPreference":
      return "Royalty Free quality preference is required when Royalty Free is selected."
    default:
      return "This field is required."
  }
}

function mapRegisterServerErrorToField(error: unknown, message: string): string | null {
  const errorCode = readErrorCode(error).toLowerCase()
  if (errorCode === "username_is_already_taken" || errorCode === "invalid_username") {
    return "username"
  }
  if (errorCode === "user_already_exists" || errorCode === "user_already_exists_use_another_email") {
    return "companyEmail"
  }
  if (errorCode === "block_invalid_email") return "companyEmail"
  if (errorCode.startsWith("missing_") || errorCode.startsWith("invalid_")) {
    return mapRegisterValidationCodeToField(errorCode)
  }

  const combined = `${errorCode} ${message}`.toLowerCase()

  if (combined.includes("username")) return "username"
  if (combined.includes("email")) return "companyEmail"
  if (combined.includes("first name")) return "firstName"
  if (combined.includes("last name")) return "lastName"
  if (combined.includes("company type")) return "companyType"
  if (combined.includes("company name")) return "companyName"
  if (combined.includes("job title")) return combined.includes("custom") ? "customJobTitle" : "jobTitle"
  if (combined.includes("country code")) return "phoneCountryCode"
  if (combined.includes("phone number") || combined.includes("telephone")) return "phoneNumber"
  if (combined.includes("password")) return "password"

  return null
}

function mapRegisterValidationCodeToField(errorCode: string): string | null {
  if (errorCode.includes("username")) return "username"
  if (errorCode.includes("email") || errorCode.includes("company_email")) return "companyEmail"
  if (errorCode.includes("first_name")) return "firstName"
  if (errorCode.includes("last_name")) return "lastName"
  if (errorCode.includes("company_type")) return "companyType"
  if (errorCode.includes("company_name")) return "companyName"
  if (errorCode.includes("job_title")) return "jobTitle"
  if (errorCode.includes("phone_country")) return "phoneCountryCode"
  if (errorCode.includes("phone_number")) return "phoneNumber"
  if (errorCode.includes("interested_asset")) return "interestedAssetTypes"
  if (errorCode.includes("image_quantity") || errorCode.includes("editorial_quantity")) return "imageQuantityRange"
  if (errorCode.includes("image_quality") || errorCode.includes("editorial_quality")) return "imageQualityPreference"
  if (errorCode.includes("royalty_free_quantity")) return "royaltyFreeQuantityRange"
  if (errorCode.includes("royalty_free_quality")) return "royaltyFreeQualityPreference"
  if (errorCode.includes("password")) return "password"
  return null
}

function mapSignInServerErrorToField(error: unknown, message: string): string | null {
  const errorCode = readErrorCode(error).toLowerCase()
  if (errorCode === "invalid_credential" || errorCode === "invalid_credentials") return "identifier"

  const combined = `${errorCode} ${message}`.toLowerCase()
  if (combined.includes("invalid_credentials") || combined.includes("invalid credential")) return "identifier"
  if (combined.includes("invalid username or password")) return "identifier"
  if (errorCode === "invalid_username") return "identifier"
  if (combined.includes("credential")) return "identifier"
  if (combined.includes("email") && !combined.includes("invalid_credentials")) return "identifier"
  if (combined.includes("password")) return "password"

  return null
}

function readErrorCode(error: unknown) {
  const codeCandidate = getFirstStringValue(error, [
    "code",
    "error.code",
    "cause.code",
    "data.code",
    "response.code",
    "response.data.code",
    "response.data.error.code",
  ])
  if (codeCandidate) return codeCandidate

  const statusCandidate = getFirstStringValue(error, ["status", "response.status", "response.data.status"])
  if (statusCandidate) return statusCandidate

  return ""
}

function readErrorStatus(error: unknown) {
  const numericStatus = getFirstNumberValue(error, ["status", "response.status", "data.status"])
  if (numericStatus) return numericStatus

  const statusAsString = getFirstStringValue(error, ["status", "response.status", "data.status"])
  if (!statusAsString) return null

  const parsedStatus = Number.parseInt(statusAsString, 10)
  if (Number.isNaN(parsedStatus)) return null

  return parsedStatus
}

function readErrorMessage(error: unknown) {
  return getFirstStringValue(error, [
    "message",
    "error.message",
    "cause.message",
    "data.message",
    "data.error.message",
    "response.statusText",
    "response.data.message",
    "response.data.error.message",
  ])
}

function getFirstStringValue(target: unknown, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(target, path)
    if (typeof value === "string" && value.trim()) return value
  }

  return ""
}

function getFirstNumberValue(target: unknown, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(target, path)
    if (typeof value === "number" && Number.isFinite(value)) return value
  }

  return null
}

function getNestedValue(target: unknown, path: string) {
  const segments = path.split(".")
  let cursor: unknown = target

  for (const segment of segments) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined
    cursor = (cursor as Record<string, unknown>)[segment]
  }

  return cursor
}

/** Dark-glass select option styling — native dropdown panels render dark. */
const darkSelectOptionsClassName =
  "[&_option]:bg-[#0e1216] [&_option]:text-white [&_optgroup]:bg-[#0e1216] [&_optgroup]:text-white"

const inputClassName =
  `h-[52px] w-full min-w-0 rounded-[14px] border border-white/18 bg-white/8 px-4 text-sm text-white shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-white/40 focus:border-[rgba(0,180,190,0.8)] focus:shadow-[0_0_0_4px_rgba(0,180,190,0.12)] focus:ring-0 ${darkSelectOptionsClassName}`

const inputErrorClassName =
  `h-[52px] w-full min-w-0 rounded-[14px] border border-red-400/80 bg-red-500/10 px-4 text-sm text-white shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-white/40 focus:border-red-400 focus:shadow-[0_0_0_4px_rgba(248,113,113,0.15)] focus:ring-0 ${darkSelectOptionsClassName}`

const labelClassName = "fc-label text-xs uppercase tracking-[0.11em] text-white/70"

const primaryButtonClassName =
  "h-[54px] w-full rounded-[14px] bg-(--auth-teal) px-5 text-sm font-bold text-(--auth-teal-deep) transition-all hover:-translate-y-px hover:shadow-[0_14px_32px_rgba(0,168,181,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--auth-teal) disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none"

const registerChoiceCardClassName =
  "block w-full rounded-[14px] border border-white/18 bg-white/6 p-5 text-left transition-colors hover:border-[rgba(0,180,190,0.6)] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--auth-teal)"

/** Compact labels inside the interest fieldset — fluid size, sentence case, no wrap breaks on asterisk. */
const interestSubfieldLabelClassName =
  "fc-label block min-w-0 font-medium leading-snug text-white/80 normal-case tracking-normal text-[clamp(0.6875rem,3.25cqi,0.8125rem)]"

const interestPreferenceGridClassName =
  "grid min-w-0 grid-cols-1 gap-3 border-t border-white/14 pt-3 @min-[22rem]/interest:grid-cols-2 @min-[22rem]/interest:gap-4"

function InterestSubfieldLabel({ text }: { text: string }) {
  return (
    <span className={interestSubfieldLabelClassName}>
      <span className="inline-flex max-w-full min-w-0 flex-wrap items-baseline gap-x-1">
        <span className="min-w-0">{text}</span>
        <span className="shrink-0 text-red-300" aria-hidden="true">
          *
        </span>
      </span>
    </span>
  )
}

function InterestPreferenceFields({
  assetLabel,
  quantityName,
  qualityName,
  quantityError,
  qualityError,
}: {
  assetLabel: string
  quantityName: string
  qualityName: string
  quantityError?: string
  qualityError?: string
}) {
  return (
    <div className={interestPreferenceGridClassName}>
      <label data-auth-field={quantityName} className="block min-w-0 space-y-1.5">
        <InterestSubfieldLabel text={`${assetLabel} quantity`} />
        <select name={quantityName} className={inputClassName} defaultValue="">
          <option value="" disabled>
            Select range
          </option>
          <option value="0_20">0–20</option>
          <option value="20_50">20–50</option>
          <option value="50_100">50–100</option>
          <option value="100_250">100–250</option>
          <option value="250_plus">250+</option>
        </select>
        <FieldError>{quantityError}</FieldError>
      </label>
      <label data-auth-field={qualityName} className="block min-w-0 space-y-1.5">
        <InterestSubfieldLabel text={`${assetLabel} quality`} />
        <select name={qualityName} className={inputClassName} defaultValue="">
          <option value="" disabled>
            Select quality
          </option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <FieldError>{qualityError}</FieldError>
      </label>
    </div>
  )
}
