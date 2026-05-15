"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ContributorApiError,
  createContributorEvent,
  getContributorAssetCategories,
  getContributorMe,
  getContributorPortalContributors,
  type ContributorAssetCategoryDto,
  type ContributorAuthResponse,
  type ContributorPortalContributorDto,
} from "@/lib/api/contributor-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function portalRoleOf(session: ContributorAuthResponse) {
  return session.account.portalRole ?? "STANDARD"
}

export function ContributorEventCreateForm(props: { initialSession?: ContributorAuthResponse }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [session, setSession] = useState<ContributorAuthResponse | null>(props.initialSession ?? null)
  const [categories, setCategories] = useState<ContributorAssetCategoryDto[]>([])
  const [contributors, setContributors] = useState<ContributorPortalContributorDto[]>([])
  const [targetContributorId, setTargetContributorId] = useState("")

  const effectiveSession = session ?? props.initialSession ?? null

  useEffect(() => {
    if (props.initialSession) return
    void getContributorMe()
      .then((me) => {
        setSession(me)
        setTargetContributorId(me.contributor.id)
      })
      .catch(() => setSession(null))
  }, [props.initialSession])

  useEffect(() => {
    void getContributorAssetCategories()
      .then((r) => setCategories(r.categories))
      .catch(() => setCategories([]))
  }, [])

  const isPortalAdmin = effectiveSession ? portalRoleOf(effectiveSession) === "PORTAL_ADMIN" : false

  useEffect(() => {
    if (!effectiveSession || portalRoleOf(effectiveSession) !== "PORTAL_ADMIN") return
    void getContributorPortalContributors({ limit: 100 })
      .then((r) => {
        setContributors(r.contributors)
        setTargetContributorId((prev) => prev || r.contributors[0]?.id || effectiveSession.contributor.id)
      })
      .catch(() => setContributors([]))
  }, [effectiveSession])

  useEffect(() => {
    if (effectiveSession && portalRoleOf(effectiveSession) === "PORTAL_ADMIN" && !targetContributorId) {
      setTargetContributorId(effectiveSession.contributor.id)
    }
  }, [effectiveSession, targetContributorId])

  async function onSubmit(formData: FormData) {
    setError(null)
    if (!categories.length) {
      setError("Categories are not available yet. Try again later.")
      return
    }
    const categoryId = String(formData.get("categoryId") ?? "").trim()
    if (!categoryId) {
      setError("Select a category.")
      return
    }
    if (isPortalAdmin && !targetContributorId) {
      setError("Select a photographer.")
      return
    }
    setPending(true)
    try {
      await createContributorEvent({
        name: String(formData.get("name") ?? "").trim(),
        categoryId,
        ...(isPortalAdmin && targetContributorId ? { targetContributorId } : {}),
        eventDate: String(formData.get("eventDate") ?? "").trim() || undefined,
        eventTime: String(formData.get("eventTime") ?? "").trim() || undefined,
        country: String(formData.get("country") ?? "").trim() || undefined,
        stateRegion: String(formData.get("stateRegion") ?? "").trim() || undefined,
        city: String(formData.get("city") ?? "").trim() || undefined,
        location: String(formData.get("location") ?? "").trim() || undefined,
        keywords: String(formData.get("keywords") ?? "").trim() || undefined,
        description: String(formData.get("description") ?? "").trim() || undefined,
      })
      router.push("/contributor/events")
      router.refresh()
    } catch (err) {
      if (err instanceof ContributorApiError) setError(err.message)
      else setError("Something went wrong. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="mx-auto max-w-xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        void onSubmit(new FormData(e.currentTarget))
      }}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Event name <span className="text-destructive">*</span>
        </label>
        <Input id="name" name="name" required minLength={2} maxLength={180} autoComplete="off" />
      </div>
      <div className="space-y-2">
        <label htmlFor="categoryId" className="text-sm font-medium text-foreground">
          Category <span className="text-destructive">*</span>
        </label>
        <select
          id="categoryId"
          name="categoryId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue=""
        >
          <option value="" disabled>
            Select a category…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {isPortalAdmin ? (
        <div className="space-y-2">
          <label htmlFor="targetContributorId" className="text-sm font-medium text-foreground">
            Photographer <span className="text-destructive">*</span>
          </label>
          <select
            id="targetContributorId"
            required
            value={targetContributorId}
            onChange={(e) => setTargetContributorId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {contributors.length === 0 && effectiveSession ? (
              <option value={effectiveSession.contributor.id}>{effectiveSession.contributor.displayName}</option>
            ) : null}
            {contributors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
                {p.email ? ` (${p.email})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : effectiveSession ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Photographer: <span className="font-medium text-foreground">{effectiveSession.contributor.displayName}</span>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="eventDate" className="text-sm font-medium text-foreground flex items-center justify-between">
            Event date <span className="text-xs font-normal text-muted-foreground">Optional</span>
          </label>
          <Input id="eventDate" name="eventDate" type="date" />
        </div>
        <div className="space-y-2">
          <label htmlFor="eventTime" className="text-sm font-medium text-foreground flex items-center justify-between">
            Event time <span className="text-xs font-normal text-muted-foreground">Optional</span>
          </label>
          <Input id="eventTime" name="eventTime" placeholder="e.g. 7:00 PM" />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="country" className="text-sm font-medium text-foreground flex items-center justify-between">
          Country <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <Input id="country" name="country" />
      </div>
      <div className="space-y-2">
        <label htmlFor="stateRegion" className="text-sm font-medium text-foreground flex items-center justify-between">
          State / Region <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <Input id="stateRegion" name="stateRegion" />
      </div>
      <div className="space-y-2">
        <label htmlFor="city" className="text-sm font-medium text-foreground flex items-center justify-between">
          City <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <Input id="city" name="city" />
      </div>
      <div className="space-y-2">
        <label htmlFor="location" className="text-sm font-medium text-foreground flex items-center justify-between">
          Location <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <Input id="location" name="location" />
      </div>
      <div className="space-y-2">
        <label htmlFor="keywords" className="text-sm font-medium text-foreground flex items-center justify-between">
          Keywords <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <Input id="keywords" name="keywords" placeholder="Comma-separated" />
      </div>
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium text-foreground flex items-center justify-between">
          Description <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className={cn(
            "flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create event"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
