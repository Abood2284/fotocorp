"use client"

import { useState } from "react"

export function ExpandableCaption({ caption }: { caption: string }) {
  const [isExpanded, setIsExpanded] = useState(false)

  // A rough estimate of caption length where truncation is useful (e.g. 180 characters)
  const shouldTruncate = caption.length > 180

  if (!shouldTruncate) {
    return <p className="fc-body-serif-md max-w-5xl text-muted-foreground">{caption}</p>
  }

  return (
    <div className="max-w-5xl">
      <p className={`fc-body-serif-md text-muted-foreground ${isExpanded ? "" : "line-clamp-2"}`}>
        {caption}
      </p>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-1.5 font-sans text-[11px] font-bold uppercase tracking-wider text-black hover:underline cursor-pointer border-none bg-transparent p-0"
      >
        {isExpanded ? "Show less" : "Read more"}
      </button>
    </div>
  )
}
