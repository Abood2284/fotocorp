"use client"

import { Search, Filter, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition, useRef, useEffect } from "react"

export function Th({
  children,
  className,
  filterControl,
  scope,
}: {
  children: React.ReactNode
  className?: string
  filterControl?: React.ReactNode
  scope?: "col" | "row"
}) {
  return (
    <th
      scope={scope ?? "col"}
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {filterControl}
      </span>
    </th>
  )
}

export function HeaderSearchFilter({
  query,
  basePath,
}: {
  query: URLSearchParams
  basePath: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const value = query.get("q") ?? ""

  useEffect(() => {
    const el = detailsRef.current
    if (!el) return
    const observer = new MutationObserver(() => {
      if (el.open) {
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    })
    observer.observe(el, { attributes: true, attributeFilter: ["open"] })
    return () => observer.disconnect()
  }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const next = new URLSearchParams(query)
    const q = String(formData.get("q") ?? "").trim()
    if (q) next.set("q", q)
    else next.delete("q")
    next.delete("cursor")
    startTransition(() => router.replace(`${basePath}?${next.toString()}`))
    detailsRef.current?.removeAttribute("open")
  }

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className="inline-flex cursor-pointer list-none items-center rounded p-1 hover:bg-muted/50"
        aria-label="Search"
      >
        <Search size={14} />
      </summary>
      <form onSubmit={handleSubmit} className="absolute left-0 z-20 mt-1 w-64 rounded-md border border-border bg-card p-3 shadow-xl">
        <input
          ref={inputRef}
          name="q"
          defaultValue={value}
          placeholder="Search name or email..."
          className="mb-2 h-8 w-full rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          className="w-full rounded bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
      </form>
    </details>
  )
}

export function HeaderSelectFilter({
  query,
  name,
  options,
  basePath,
}: {
  query: URLSearchParams
  name: string
  options: Array<{ value: string; label: string }>
  basePath: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const value = query.get(name) ?? ""

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const next = new URLSearchParams(query)
    const val = String(formData.get(name) ?? "").trim()
    if (val) next.set(name, val)
    else next.delete(name)
    next.delete("cursor")
    startTransition(() => router.replace(`${basePath}?${next.toString()}`))
    detailsRef.current?.removeAttribute("open")
  }

  return (
    <details ref={detailsRef} className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center rounded p-1 hover:bg-muted/50">
        <Filter size={14} />
      </summary>
      <form onSubmit={handleSubmit} className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-card p-2 shadow-xl">
        <select
          name={name}
          defaultValue={value}
          className="mb-2 h-8 w-full rounded border border-border bg-background px-2 text-xs"
        >
          {options.map((option) => (
            <option key={`${name}-${option.value || "all"}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="w-full rounded bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
      </form>
    </details>
  )
}

export function ActiveFilterChips({
  query,
  chips,
  basePath,
}: {
  query: URLSearchParams
  chips: Array<{ key: string; value: string; label: string }>
  basePath: string
}) {
  if (!chips.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((item) => (
        <Link
          key={item.key}
          href={`${basePath}?${withoutParam(query, item.key)}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs transition-colors hover:bg-muted"
        >
          <span className="font-medium text-muted-foreground">{item.label}:</span>{" "}
          {item.value}
          <X className="ml-1" size={12} />
        </Link>
      ))}
      <Link href={basePath} className="text-xs font-medium text-primary hover:underline">
        Clear all
      </Link>
    </div>
  )
}

export function withoutParam(query: URLSearchParams, key: string) {
  const next = new URLSearchParams(query)
  next.delete(key)
  return next.toString()
}

export function chip(key: string, value: string | null, label: string) {
  if (!value) return null
  return { key, value, label }
}
