"use client"

import { useState } from "react"
import { HelpArticleMarkdown } from "@/components/staff/help/help-article-markdown"
import { cn } from "@/lib/utils"

interface HelpMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function HelpMarkdownEditor({ value, onChange, error }: HelpMarkdownEditorProps) {
  const [tab, setTab] = useState<"write" | "preview">("write")

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="help-body-markdown">
          Body markdown
        </label>
        <div className="inline-flex rounded-md border border-border p-0.5" role="tablist" aria-label="Markdown editor mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "write"}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium",
              tab === "write" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            onClick={() => setTab("write")}
          >
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium",
              tab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
        </div>
      </div>

      {tab === "write" ? (
        <textarea
          id="help-body-markdown"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={18}
          placeholder="Write step-by-step guidance here. Use headings, lists, screenshots references, and short instructions."
          className={cn(
            "w-full rounded-md border border-border bg-background px-3 py-3 font-mono text-sm leading-6",
            error && "border-destructive",
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "help-body-markdown-error" : undefined}
        />
      ) : (
        <div className="min-h-[18rem] rounded-md border border-border bg-card p-4">
          {value.trim() ? (
            <HelpArticleMarkdown content={value} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}

      {error ? (
        <p id="help-body-markdown-error" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
