"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { postStaffCloseAccessInquiry, StaffApiError } from "@/lib/api/staff-api"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/staff/shared/confirm-dialog"

interface AccessInquiryCloseButtonProps {
  inquiryId: string
  label?: string
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost"
  size?: "default" | "sm" | "lg"
  onClosed?: () => void
}

export function AccessInquiryCloseButton({
  inquiryId,
  label = "Close inquiry",
  variant = "outline",
  size = "sm",
  onClosed,
}: AccessInquiryCloseButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleClose() {
    setError("")
    setLoading(true)
    try {
      await postStaffCloseAccessInquiry(inquiryId, {})
      setOpen(false)
      onClosed?.()
      router.refresh()
    } catch (caught) {
      if (caught instanceof StaffApiError) setError(caught.message)
      else setError("Could not close inquiry.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        title="Close inquiry?"
        description="This marks the inquiry closed without granting access. The customer or applicant will not receive entitlements or contributor credentials."
        variant="destructive"
        loading={loading}
        onConfirm={() => void handleClose()}
        onCancel={() => setOpen(false)}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </>
  )
}
