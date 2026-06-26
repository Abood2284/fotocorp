import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"
import { cn } from "@/lib/utils"

interface HelpArticleMarkdownProps {
  content: string
  className?: string
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 font-serif text-2xl font-semibold text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-7 font-serif text-xl font-semibold text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 font-serif text-lg font-semibold text-foreground first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mt-4 text-sm leading-7 text-foreground-body first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-foreground-body">{children}</ul>,
  ol: ({ children }) => (
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-foreground-body">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-4 border-primary/40 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children }) => {
    const isBlock = Boolean(className)
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-xs text-foreground">
          {children}
        </code>
      )
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>
    )
  },
  pre: ({ children }) => <pre className="mt-4 overflow-x-auto">{children}</pre>,
}

export function HelpArticleMarkdown({ content, className }: HelpArticleMarkdownProps) {
  return (
    <div className={cn("help-article-markdown", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
