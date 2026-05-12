"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, useEffect } from "react"
import { Search, X, Image as ImageIcon, PlayCircle, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchBarProps {
  defaultValue?: string
  placeholder?: string
  size?: "default" | "lg"
  variant?: "default" | "pill" | "minimal"
  showTypeSelect?: boolean
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

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "relative flex w-full items-center transition-all duration-300",
        "bg-[#F4F4F5]",
        variant === "pill" ? "rounded-[32px]" : (size === "lg" ? "rounded-xl" : "rounded-md"),
        className
      )}
      role="search"
    >
      {showTypeSelect && (
        <div className="relative pl-2 py-2 flex shrink-0 items-center" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsTypeSelectOpen(!isTypeSelectOpen)}
            className="flex items-center gap-2 rounded-full bg-[#E5E7EB] hover:bg-[#D1D5DB] transition-colors px-4 py-2 text-[0.95rem] font-medium text-foreground outline-none"
          >
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span>{selectedType === "photos" ? "Photos" : "Videos"}</span>
            {isTypeSelectOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {isTypeSelectOpen && (
            <div className="absolute left-2 top-[calc(100%+8px)] z-50 w-40 overflow-hidden rounded-xl bg-background p-2 shadow-lg border border-border/40">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
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
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
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
              "pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/60",
              size === "lg" ? "h-5 w-5" : "h-4 w-4",
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
            !showTypeSelect && (size === "lg" ? "pl-14" : "pl-11"),
            showTypeSelect && "pl-4",
            size === "lg" ? "h-14 pr-5 text-[1.05rem]" : "h-12 pr-4 text-[0.95rem]",
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
            className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      <button
        type="submit"
        className="shrink-0 flex items-center justify-center pr-5 pl-2 h-full text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Submit search"
      >
        <Search className="h-5 w-5" strokeWidth={2} />
      </button>
    </form>
  )
}
