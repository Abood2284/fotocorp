"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, useEffect } from "react"
import { Search, X, Image as ImageIcon, PlayCircle, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchBarProps {
  defaultValue?: string
  placeholder?: string
  size?: "default" | "lg" | "compact"
  variant?: "default" | "pill" | "sharp" | "minimal"
  showTypeSelect?: boolean
  /** Where the Photos/Videos menu opens relative to the trigger. Use "above" when content sits directly below the bar. */
  typeSelectMenuPlacement?: "above" | "below"
  className?: string
  /** If true, navigation happens on submit. If false, calls onSearch. */
  navigate?: boolean
  onSearch?: (query: string) => void
}

export function SearchBar({
  defaultValue = "",
  placeholder = "Search for free photos",
  size = "default",
  variant = "pill",
  showTypeSelect = false,
  typeSelectMenuPlacement = "below",
  className,
  navigate = true,
  onSearch,
}: SearchBarProps) {
  const router = useRouter()
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const [isTypeSelectOpen, setIsTypeSelectOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<"photos" | "videos">("photos")
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTypeSelectOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = value.trim()
    if (navigate) {
      router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search")
    } else {
      onSearch?.(q)
    }
  }

  const isCompact = size === "compact"
  const isLarge = size === "lg"
  const isSharp = variant === "sharp"

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "relative flex w-full items-center transition-all duration-300",
        isSharp ? "bg-background" : "bg-[#F4F4F5]",
        variant === "pill"
          ? isCompact
            ? "rounded-[26px]"
            : "rounded-[32px]"
          : isSharp
            ? "rounded-sm"
            : isLarge
              ? "rounded-xl"
              : "rounded-md",
        className
      )}
      role="search"
    >
      {showTypeSelect && (
        <div
          className={cn(
            "relative z-50 flex shrink-0 items-center",
            isCompact ? "py-1.5 pl-2" : "py-2 pl-2",
            isSharp && "border-r border-border",
          )}
          ref={dropdownRef}
        >
          <button
            type="button"
            onClick={() => setIsTypeSelectOpen(!isTypeSelectOpen)}
            className={cn(
              "flex items-center font-medium text-foreground outline-none transition-colors",
              isSharp
                ? "rounded-sm border border-border bg-muted/50 hover:bg-muted"
                : "rounded-full bg-[#E5E7EB] hover:bg-[#D1D5DB]",
              isCompact
                ? "gap-1.5 px-3 py-1.5 text-sm"
                : "gap-2 px-4 py-2 text-[0.95rem]",
            )}
          >
            <ImageIcon className={cn("text-muted-foreground", isCompact ? "h-4 w-4" : "h-4 w-4")} />
            <span>{selectedType === "photos" ? "Photos" : "Videos"}</span>
            {isTypeSelectOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          
          {isTypeSelectOpen && (
            <div
              role="listbox"
              className={cn(
                "absolute left-2 z-50 w-40 overflow-hidden bg-background p-2 shadow-lg border border-border",
                isSharp ? "rounded-sm" : "rounded-xl border-border/40",
                typeSelectMenuPlacement === "above"
                  ? "bottom-[calc(100%+8px)]"
                  : "top-[calc(100%+8px)]",
              )}
            >
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted",
                  isSharp ? "rounded-sm" : "rounded-lg",
                )}
                onClick={() => {
                  setSelectedType("photos")
                  setIsTypeSelectOpen(false)
                }}
              >
                <ImageIcon className={cn("h-5 w-5", selectedType === "photos" ? "text-emerald-500" : "text-muted-foreground")} />
                <span className={cn(selectedType === "photos" ? "text-emerald-500" : "text-foreground")}>Photos</span>
              </button>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted",
                  isSharp ? "rounded-sm" : "rounded-lg",
                )}
                onClick={() => {
                  setSelectedType("videos")
                  setIsTypeSelectOpen(false)
                }}
              >
                <PlayCircle className={cn("h-5 w-5", selectedType === "videos" ? "text-emerald-500" : "text-muted-foreground")} />
                <span className={cn(selectedType === "videos" ? "text-emerald-500" : "text-foreground")}>Videos</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div 
        className="relative flex-1 flex items-center cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {!showTypeSelect && (
          <Search
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground/60",
              isLarge ? "left-5 h-5 w-5" : isCompact ? "left-3.5 h-3.5 w-3.5" : "left-5 h-4 w-4",
            )}
            strokeWidth={1.5}
          />
        )}
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full bg-transparent text-foreground placeholder:text-[#9CA3AF]",
            "appearance-none shadow-none",
            "border-none !outline-none !ring-0",
            "focus:border-none focus:!outline-none focus:!ring-0 focus:shadow-none",
            "focus-visible:border-none focus-visible:!outline-none focus-visible:!ring-0 focus-visible:shadow-none",
            "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
            !showTypeSelect && (isLarge ? "pl-14" : isCompact ? "pl-9" : "pl-11"),
            showTypeSelect && (isCompact ? "pl-3" : "pl-4"),
            isLarge && "h-14 pr-5 text-[1.05rem]",
            isCompact && "h-10 pr-3.5 text-sm",
            !isLarge && !isCompact && "h-12 pr-4 text-[0.95rem]",
          )}
        />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setValue("")
              inputRef.current?.focus()
            }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground",
              isCompact ? "right-10" : "right-12",
            )}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      <button
        type="submit"
        className={cn(
          "flex h-full shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
          isCompact ? "pl-2 pr-3.5" : "pl-2 pr-5",
        )}
        aria-label="Submit search"
      >
        <Search className={isCompact ? "h-[1.125rem] w-[1.125rem]" : "h-5 w-5"} strokeWidth={2} />
      </button>
    </form>
  )
}
