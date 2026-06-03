"use client"

import { Archive, Check, Loader2 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import { FotoboxBoardPicker } from "@/components/assets/fotobox-board-picker"
import { Button } from "@/components/ui/button"
import { buildFotoboxAuthPathname } from "@/lib/fotobox-auth-gate"
import { useSharedAuthSession } from "@/lib/use-shared-auth-session"
import { cn } from "@/lib/utils"

interface FotoboxSaveButtonProps {
  assetId: string
  variant?: "primary" | "secondary" | "ghost"
  className?: string
  buttonClassName?: string
  text?: string
  icon?: React.ReactNode
  iconOnly?: boolean
  hoverLabel?: string
}

export function FotoboxSaveButton({
  assetId,
  variant = "secondary",
  className,
  buttonClassName,
  text = "Add to Fotobox",
  icon,
  iconOnly = false,
  hoverLabel = "save to fotobox",
}: FotoboxSaveButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = useSharedAuthSession()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  function openAuthGate() {
    router.push(buildFotoboxAuthPathname(pathname))
  }

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (isPending) return
    if (!session?.user) {
      openAuthGate()
      return
    }
    setPickerOpen(true)
  }

  function handlePickerClose(open: boolean) {
    setPickerOpen(open)
    if (!open && session?.user) setSaved(true)
  }

  const label = saved ? "Saved to Fotobox" : text
  const tooltip = hoverLabel
  const actionIcon = saved ? (
    <Check size={20} />
  ) : (
    icon ?? <Archive size={20} />
  )

  return (
    <div className={cn(iconOnly ? "group relative" : "space-y-2", className)}>
      <Button
        type="button"
        variant={variant === "primary" ? "default" : variant === "ghost" ? "ghost" : "outline"}
        className={cn(
          "justify-center",
          iconOnly ? "h-9 w-9 border-0 p-0" : variant !== "ghost" && "h-11 w-full",
          buttonClassName,
        )}
        onClick={handleClick}
        disabled={isPending}
        aria-label={iconOnly ? tooltip : label}
        aria-busy={isPending}
      >
        {isPending ? (
          <Loader2 className="animate-spin" size={iconOnly ? 20 : 16} />
        ) : iconOnly ? (
          actionIcon
        ) : (
          <>
            {saved ? <Check className="mr-2" size={16} /> : icon ? icon : <Archive className="mr-2" size={16} />}
            {label}
          </>
        )}
      </Button>
      {iconOnly && (
        <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-md bg-black/40 px-3 py-2 text-xs font-medium text-white/90 opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          {tooltip}
        </span>
      )}
      {!iconOnly && saved && (
        <Link href="/account/fotobox" className="block text-center text-sm font-medium text-foreground underline underline-offset-4">
          View Fotobox
        </Link>
      )}
      {session?.user ? (
        <FotoboxBoardPicker
          assetId={assetId}
          open={pickerOpen}
          onOpenChange={handlePickerClose}
        />
      ) : null}
    </div>
  )
}
