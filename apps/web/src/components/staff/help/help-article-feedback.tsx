"use client"

import { useState } from "react"
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface HelpArticleFeedbackProps {
  articleId: string
}

type FeedbackPhase = "idle" | "comment" | "submitting" | "success" | "error"

export function HelpArticleFeedback({ articleId }: HelpArticleFeedbackProps) {
  const [phase, setPhase] = useState<FeedbackPhase>("idle")
  const [comment, setComment] = useState("")
  const [pendingHelpful, setPendingHelpful] = useState<boolean | null>(null)
  const isSubmitting = phase === "submitting"

  async function submitFeedback(helpful: boolean, optionalComment?: string) {
    if (phase === "submitting" || phase === "success") return

    setPhase("submitting")
    setPendingHelpful(helpful)

    try {
      const response = await fetch(`/api/staff/help/articles/${encodeURIComponent(articleId)}/feedback`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wasHelpful: helpful,
          comment: optionalComment?.trim() ? optionalComment.trim() : undefined,
        }),
      })

      if (!response.ok) {
        setPhase("error")
        return
      }

      setPhase("success")
    } catch {
      setPhase("error")
    }
  }

  if (phase === "success") {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground">Thanks for the feedback.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-sm font-medium text-foreground">Was this helpful?</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSubmitting}
          onClick={() => submitFeedback(true)}
          className={cn(pendingHelpful === true && phase !== "comment" && "border-primary bg-primary-wash")}
        >
          {isSubmitting && pendingHelpful === true ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ThumbsUp className="mr-2 h-4 w-4" aria-hidden />
          )}
          Yes
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSubmitting}
          onClick={() => {
            setPendingHelpful(false)
            setPhase("comment")
          }}
          className={cn(phase === "comment" && "border-primary bg-primary-wash")}
        >
          <ThumbsDown className="mr-2 h-4 w-4" aria-hidden />
          No
        </Button>
      </div>

      {phase === "comment" ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            submitFeedback(false, comment)
          }}
        >
          <label htmlFor="help-feedback-comment" className="text-sm text-muted-foreground">
            What was missing?
          </label>
          <textarea
            id="help-feedback-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1000}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Optional — tell us what would make this guide more useful."
          />
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting && pendingHelpful === false ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Send feedback
          </Button>
        </form>
      ) : null}

      {phase === "error" ? (
        <p className="mt-3 text-sm text-destructive">Could not submit feedback. Please try again.</p>
      ) : null}
    </div>
  )
}
