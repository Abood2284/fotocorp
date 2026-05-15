"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { all as allCountries } from "country-codes-list"
import { authClient } from "@/lib/auth-client"
import { resolveAuthRedirectFromSearchParams } from "@/lib/auth-redirect"
import { validateBusinessEmail } from "@/lib/api/auth-api"
import { isValidUsername, normalizeUsername } from "@/lib/username"

type AuthTab = "sign-in" | "register"
type EmailValidationStatus = "idle" | "checking" | "allowed" | "blocked" | "error"
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
  "phoneCountryCode",
  "phoneNumber",
  "password",
] as const

const fieldErrorTextClass = "text-xs font-medium text-red-600"

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
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<AuthTab>(() => {
    const tab = searchParams.get("tab")
    return tab === "register" ? "register" : "sign-in"
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [jobTitle, setJobTitle] = useState("")
  const [companyEmail, setCompanyEmail] = useState("")
  const [interest, setInterest] = useState({ IMAGE: false, VIDEO: false, CARICATURE: false })
  const [notice, setNotice] = useState("")
  const [emailStatus, setEmailStatus] = useState<EmailValidationStatus>("idle")
  const [emailStatusMessage, setEmailStatusMessage] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isEmailCheckPending, startEmailCheckTransition] = useTransition()
  const callingCodes = useMemo(getCallingCodeOptions, [])
  const debounceTimeoutRef = useRef<number | null>(null)

  const redirectTo = useMemo(() => resolveAuthRedirectFromSearchParams(searchParams), [searchParams])

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "register") setActiveTab("register")
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) window.clearTimeout(debounceTimeoutRef.current)
    }
  }, [])

  function switchTab(tab: AuthTab) {
    setActiveTab(tab)
    setErrors({})
    setNotice("")
    if (tab === "sign-in") setInterest({ IMAGE: false, VIDEO: false, CARICATURE: false })
  }

  function handleCompanyEmailBlur() {
    if (activeTab !== "register") return
    void runEmailPrecheck(companyEmail)
  }

  function handleCompanyEmailChange(value: string) {
    const normalizedEmail = value.trim()
    setCompanyEmail(normalizedEmail)
    if (!isBasicEmail(normalizedEmail)) {
      setEmailStatus("idle")
      setEmailStatusMessage("")
      return
    }

    if (debounceTimeoutRef.current) window.clearTimeout(debounceTimeoutRef.current)
    debounceTimeoutRef.current = window.setTimeout(() => {
      void runEmailPrecheck(normalizedEmail)
    }, 500)
  }

  async function runEmailPrecheck(rawEmail: string) {
    const normalizedEmail = rawEmail.trim()
    if (!isBasicEmail(normalizedEmail)) {
      setEmailStatus("idle")
      setEmailStatusMessage("")
      return
    }

    setEmailStatus("checking")
    setEmailStatusMessage("Checking company email...")
    startEmailCheckTransition(async () => {
      const response = await validateBusinessEmail({ email: normalizedEmail }).catch(() => null)
      if (!response) {
        setEmailStatus("error")
        setEmailStatusMessage("Email validation is temporarily unavailable. Please try again.")
        return
      }

      if (response.ok) {
        setEmailStatus("allowed")
        setEmailStatusMessage(response.message)
        return
      }

      setEmailStatus("blocked")
      setEmailStatusMessage(response.message)
    })
  }

  function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice("")
    const formData = new FormData(event.currentTarget)
    const nextErrors: FormErrors = {}
    const identifier = String(formData.get("identifier") ?? "").trim()
    const password = String(formData.get("password") ?? "")

    if (!identifier) nextErrors.identifier = "Username or company email is required."
    if (!password) nextErrors.password = "Password is required."

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      queueScrollToFirstFieldError("sign-in", nextErrors)
      return
    }

    startTransition(async () => {
      try {
        const response = identifier.includes("@")
          ? await authClient.signIn.email({ email: identifier, password })
          : await authClient.signIn.username({ username: normalizeUsername(identifier), password })

        if (response.error) {
          applySignInServerError({ error: response.error, setErrors, setNotice, tab: "sign-in" })
          return
        }
      } catch (error) {
        applySignInServerError({ error, setErrors, setNotice, tab: "sign-in" })
        return
      }

      router.push(redirectTo)
      router.refresh()
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
    requireField(formData, nextErrors, "password", "Password is required.")

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

    if (emailStatus === "blocked") nextErrors.companyEmail = emailStatusMessage || "This company email is not allowed."
    if (emailStatus === "checking" || isEmailCheckPending) {
      nextErrors.companyEmail = "Please wait until company email validation completes."
    }

    const interestedAssetTypes = (["IMAGE", "VIDEO", "CARICATURE"] as const).filter((k) => interest[k])
    if (!interestedAssetTypes.length) {
      nextErrors.interestedAssetTypes = "Select at least one content type you are interested in."
    }
    if (interestedAssetTypes.includes("IMAGE")) {
      requireField(formData, nextErrors, "imageQuantityRange", "Image quantity range is required when Images is selected.")
      requireField(formData, nextErrors, "imageQualityPreference", "Image quality preference is required when Images is selected.")
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      queueScrollToFirstFieldError("register", nextErrors)
      return
    }

    const password = String(formData.get("password") ?? "")
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
      if (interestedAssetTypes.includes("IMAGE")) {
        signUpPayload.imageQuantityRange = String(formData.get("imageQuantityRange") ?? "").trim()
        signUpPayload.imageQualityPreference = String(formData.get("imageQualityPreference") ?? "").trim()
      }

      const signUp = authClient.signUp.email as unknown as (payload: Record<string, unknown>) => Promise<{ error?: unknown }>

      try {
        const response = await signUp(signUpPayload)
        if (response.error) {
          applyRegisterServerError({ error: response.error, setErrors, setNotice, tab: "register" })
          return
        }
      } catch (error) {
        applyRegisterServerError({ error, setErrors, setNotice, tab: "register" })
        return
      }

      router.push("/account/access-pending")
      router.refresh()
    })
  }

  const isCreateDisabled = isPending || emailStatus === "checking" || emailStatus === "blocked" || isEmailCheckPending

  return (
    <main className="min-h-screen bg-white text-foreground lg:grid lg:h-screen lg:grid-cols-[minmax(0,1.3fr)_minmax(420px,0.7fr)] lg:overflow-hidden xl:grid-cols-[minmax(0,1.45fr)_minmax(460px,0.65fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-primary lg:block lg:h-screen">
        <Image
          src="/images/auth_stock.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1280px) 69vw, (min-width: 1024px) 65vw, 100vw"
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

        <div className="flex min-h-0 flex-1 flex-col px-5 pb-8 sm:px-8 lg:px-10 xl:px-12">
          <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col pt-4 sm:pt-8 lg:max-w-none lg:pt-16">
            <div className="mb-8 flex border-b border-border-subtle">
              <TabButton active={activeTab === "sign-in"} onClick={() => switchTab("sign-in")}>
                SIGN IN
              </TabButton>
              <TabButton active={activeTab === "register"} onClick={() => switchTab("register")}>
                REGISTER
              </TabButton>
            </div>

            <div className="min-h-0 flex-1 lg:pr-1">
              {activeTab === "sign-in" ? (
                <form data-auth-form="sign-in" onSubmit={handleSignIn} noValidate className="space-y-5">
                  <TextField
                    label="Username or company email"
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
                    <button type="button" className="fc-label text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                      Forgot password?
                    </button>
                  </div>

                  <SubmitButton disabled={isPending}>
                    {isPending ? "Signing In..." : "Sign In"}
                  </SubmitButton>
                  <FormNotice isError>{notice}</FormNotice>
                </form>
              ) : (
                <form data-auth-form="register" onSubmit={handleRegister} noValidate className="space-y-4 pb-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="First Name" name="firstName" autoComplete="given-name" error={errors.firstName} required />
                    <TextField label="Last Name" name="lastName" autoComplete="family-name" error={errors.lastName} required />
                  </div>
                  <TextField label="Username" name="username" autoComplete="username" error={errors.username} required />
                  <SelectField label="Company Type" name="companyType" groups={COMPANY_TYPE_GROUPS} error={errors.companyType} required />
                  <TextField label="Company Name" name="companyName" autoComplete="organization" error={errors.companyName} required />
                  <SelectField
                    label="Job Title"
                    name="jobTitle"
                    groups={JOB_TITLE_GROUPS}
                    value={jobTitle}
                    onChange={setJobTitle}
                    error={errors.jobTitle}
                    required
                  />
                  {jobTitle === "Other" ? (
                    <TextField label="Job title" name="customJobTitle" autoComplete="organization-title" error={errors.customJobTitle} required />
                  ) : null}
                  <TextField
                    label="Company Email"
                    name="companyEmail"
                    type="email"
                    autoComplete="email"
                    value={companyEmail}
                    onChange={handleCompanyEmailChange}
                    onBlur={handleCompanyEmailBlur}
                    error={errors.companyEmail}
                    required
                  />
                  <EmailStatusNotice status={emailStatus} message={emailStatusMessage} />
                  <fieldset data-auth-field="interestedAssetTypes" className="space-y-3 rounded-md border border-border-subtle p-3">
                    <legend className={labelClassName}>Tell us what you need *</legend>
                    <div className="flex flex-col gap-2 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={interest.IMAGE}
                          onChange={(e) => setInterest((s) => ({ ...s, IMAGE: e.target.checked }))}
                          className="h-4 w-4 rounded border-input"
                        />
                        Images
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={interest.VIDEO}
                          onChange={(e) => setInterest((s) => ({ ...s, VIDEO: e.target.checked }))}
                          className="h-4 w-4 rounded border-input"
                        />
                        Videos
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={interest.CARICATURE}
                          onChange={(e) => setInterest((s) => ({ ...s, CARICATURE: e.target.checked }))}
                          className="h-4 w-4 rounded border-input"
                        />
                        Caricatures
                      </label>
                    </div>
                    <FieldError>{errors.interestedAssetTypes}</FieldError>
                    {interest.IMAGE ? (
                      <div className="grid gap-4 border-t border-border-subtle pt-3 sm:grid-cols-2">
                        <label data-auth-field="imageQuantityRange" className="block space-y-2">
                          <span className={labelClassName}> Quantity *</span>
                          <select name="imageQuantityRange" className={inputClassName} defaultValue="">
                            <option value="" disabled>
                              Select range
                            </option>
                            <option value="0_20">0–20</option>
                            <option value="20_50">20–50</option>
                            <option value="50_100">50–100</option>
                            <option value="100_250">100–250</option>
                            <option value="250_plus">250+</option>
                          </select>
                          <FieldError>{errors.imageQuantityRange}</FieldError>
                        </label>
                        <label data-auth-field="imageQualityPreference" className="block space-y-2">
                          <span className={labelClassName}>Quality *</span>
                          <select name="imageQualityPreference" className={inputClassName} defaultValue="">
                            <option value="" disabled>
                              Select quality
                            </option>
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                          </select>
                          <FieldError>{errors.imageQualityPreference}</FieldError>
                        </label>
                      </div>
                    ) : null}
                  </fieldset>
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
                    <TextField label="Phone Number" name="phoneNumber" type="tel" autoComplete="tel-national" error={errors.phoneNumber} required />
                  </div>
                  <TextField label="Password" name="password" type="password" autoComplete="new-password" error={errors.password} required />
                  <SubmitButton disabled={isCreateDisabled}>
                    {isPending ? "Creating Account..." : "Create Account"}
                  </SubmitButton>
                  <FormNotice isError>{notice}</FormNotice>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function TabButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 px-2 pb-4 text-center text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      <span
        className={`absolute -bottom-px left-0 h-px bg-foreground transition-all ${
          active ? "w-full opacity-100" : "w-0 opacity-0"
        }`}
      />
    </button>
  )
}

interface TextFieldProps {
  label: string
  name: string
  type?: string
  autoComplete?: string
  error?: string
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  required?: boolean
}

function TextField({
  label,
  name,
  type = "text",
  autoComplete,
  error,
  value,
  onChange,
  onBlur,
  required = false,
}: TextFieldProps) {
  return (
    <label data-auth-field={name} className="block space-y-2">
      <span className={labelClassName}>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        className={inputClassName}
        aria-invalid={Boolean(error)}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        onBlur={onBlur}
      />
      <FieldError>{error}</FieldError>
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
  required = false,
}: {
  label: string
  name: string
  groups: SelectGroup[]
  value?: string
  onChange?: (value: string) => void
  error?: string
  required?: boolean
}) {
  return (
    <label data-auth-field={name} className="block space-y-2">
      <span className={labelClassName}>
        {label}
        {required ? " *" : ""}
      </span>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className={inputClassName}
        aria-invalid={Boolean(error)}
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
      <FieldError>{error}</FieldError>
    </label>
  )
}

function EmailStatusNotice({
  status,
  message,
}: {
  status: EmailValidationStatus
  message: string
}) {
  if (status === "idle" || !message) return null
  const colorClass = status === "allowed"
    ? "text-green-700"
    : status === "checking"
      ? "text-muted-foreground"
      : "text-red-600"
  return <p className={`text-xs font-medium ${colorClass}`}>{message}</p>
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return <p className={fieldErrorTextClass}>{children}</p>
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
    ? "border-red-200 bg-red-50 text-red-600"
    : "border-border bg-surface-warm text-muted-foreground"
  return <p className={`border px-3 py-2 text-xs font-medium ${className}`}>{children}</p>
}

function SubmitButton({
  children,
  disabled = false,
}: {
  children: string
  disabled?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-2 h-12 w-full bg-primary px-5 text-sm font-semibold uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-70"
    >
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

  if (errorCode === "username_is_already_taken") return "This username is already taken."
  if (errorCode === "user_already_exists_use_another_email") return "An account with this email already exists."
  if (errorCode === "invalid_username") return USERNAME_ERROR_MESSAGE
  if (errorCode === "missing_or_null_origin") return "Authentication request is invalid. Please refresh and try again."
  if (errorCode === "block_free_email") return "Please use your company email address. Personal email providers are not accepted."
  if (errorCode === "block_disposable_email") return "Temporary email addresses are not accepted."
  if (errorCode === "block_no_mx") return "This email domain does not appear to accept email."
  if (errorCode === "block_by_email_override") return "This email address is not allowed."
  if (errorCode === "block_by_domain_override") return "This email domain is not allowed."
  if (errorCode === "valid_validation_error" || errorCode === "validation_error") {
    return "Email validation is temporarily unavailable. Please try again."
  }
  if (errorCode.includes("email")) return "Please check your company email and try again."

  if (backendMessage) {
    const rawMessage = backendMessage.trim()
    const message = rawMessage.toLowerCase()

    if (message.includes("invalid credential")) return "Invalid credentials. Please check your username or email and password."
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
  const message = humanizeAuthErrorMessage(error, "register")
  const fieldName = mapRegisterServerErrorToField(error, message)
  if (fieldName) {
    const next = { [fieldName]: message }
    setErrors(next)
    queueScrollToFirstFieldError(tab, next)
  }
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

function mapRegisterServerErrorToField(error: unknown, message: string): string | null {
  const errorCode = readErrorCode(error).toLowerCase()
  if (errorCode === "username_is_already_taken" || errorCode === "invalid_username") return "username"
  if (errorCode === "user_already_exists_use_another_email") return "companyEmail"

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

function mapSignInServerErrorToField(error: unknown, message: string): string | null {
  const errorCode = readErrorCode(error).toLowerCase()
  if (errorCode === "invalid_credential" || errorCode === "invalid_credentials") return "identifier"

  const combined = `${errorCode} ${message}`.toLowerCase()
  if (combined.includes("username")) return "identifier"
  if (combined.includes("email")) return "identifier"
  if (combined.includes("credential")) return "identifier"
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

const inputClassName =
  "h-11 w-full border border-border bg-white px-3 text-sm text-foreground shadow-none outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-0 aria-[invalid=true]:border-red-600"

const labelClassName = "fc-label text-xs uppercase tracking-[0.11em] text-foreground"
