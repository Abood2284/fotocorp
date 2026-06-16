"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  SEARCH_SEGMENTS,
  searchSegmentLabel,
  type SearchSegment,
} from "@/lib/search/search-segment"
import { cn } from "@/lib/utils"

interface SearchSegmentSelectProps {
  value: SearchSegment
  onChange: (segment: SearchSegment) => void
  disabled?: boolean
  className?: string
}

export function SearchSegmentSelect({
  value,
  onChange,
  disabled = false,
  className,
}: SearchSegmentSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} className={cn("relative flex items-center justify-center px-4 sm:px-6", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex min-h-12 w-full items-center justify-between gap-3 border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 md:min-h-0 md:border-0 md:bg-transparent md:px-0 md:text-base md:hover:bg-transparent"
      >
        <span>{searchSegmentLabel(value)}</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Search segment"
          className="absolute right-4 top-[calc(100%+8px)] z-50 min-w-[220px] overflow-hidden border border-border bg-background p-2 shadow-lg sm:right-6"
        >
          {SEARCH_SEGMENTS.map((segment) => (
            <button
              key={segment}
              type="button"
              role="option"
              aria-selected={segment === value}
              className={cn(
                "flex w-full items-center px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted",
                segment === value ? "bg-muted text-foreground" : "text-foreground",
              )}
              onClick={() => {
                onChange(segment)
                setIsOpen(false)
              }}
            >
              {searchSegmentLabel(segment)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
