"use client"

import { Loader2, Plus, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  createCaptionWriterAction,
  resetCaptionWriterPasswordAction,
  updateCaptionWriterStatusAction,
  type StaffMemberActionResult,
} from "@/app/(staff)/staff/(workspace)/staff-users/actions"
import { ConfirmDialog } from "@/components/staff/shared/confirm-dialog"
import { useToastNotify } from "@/components/staff/shared/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { StaffMemberListItem } from "@/lib/api/staff-api"
import { cn } from "@/lib/utils"

interface StaffMembersClientProps {
  initialItems: StaffMemberListItem[]
}

export function StaffMembersClient({ initialItems }: StaffMembersClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { toast } = useToastNotify()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [resetMemberId, setResetMemberId] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string
    description: string
    variant: "default" | "destructive"
    action: () => void
  } | null>(null)

  const refresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const runAction = async (action: () => Promise<StaffMemberActionResult>, successMessage: string) => {
    const result = await action()
    if (!result.ok) {
      toast({ message: result.message || "Request failed", variant: "error" })
      return
    }
    toast({ message: successMessage, variant: "success" })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Caption writers</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create staff logins for caption writers. They can access contributor uploads, captions, catalog, homepage
            hero, and events, and cannot browse the public site.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button type="button" size="sm" onClick={() => setShowCreateForm((value) => !value)}>
            <Plus className="h-4 w-4" />
            New caption writer
          </Button>
        </div>
      </div>

      {showCreateForm ? (
        <form
          className="rounded-lg border border-staff-200 bg-white p-4 shadow-sm"
          action={async (formData) => {
            await runAction(() => createCaptionWriterAction(formData), "Caption writer created")
            setShowCreateForm(false)
          }}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-staff-900">Username</span>
              <input
                name="username"
                required
                minLength={3}
                maxLength={30}
                autoComplete="off"
                className="w-full rounded-md border border-staff-200 px-3 py-2"
                placeholder="caption.writer"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-staff-900">Display name</span>
              <input
                name="displayName"
                maxLength={120}
                autoComplete="off"
                className="w-full rounded-md border border-staff-200 px-3 py-2"
                placeholder="Caption Writer"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-staff-900">Temporary password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-md border border-staff-200 px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              Create account
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-staff-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-staff-200 text-sm">
          <thead className="bg-staff-50 text-left text-xs uppercase tracking-wide text-staff-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Username</th>
              <th className="px-4 py-3 font-semibold">Display name</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Last login</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-staff-100">
            {initialItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No caption writer accounts yet.
                </td>
              </tr>
            ) : (
              initialItems.map((member) => (
                <tr key={member.id} className="hover:bg-staff-50/60">
                  <td className="px-4 py-3 font-medium text-staff-950">{member.username}</td>
                  <td className="px-4 py-3 text-staff-700">{member.displayName}</td>
                  <td className="px-4 py-3">
                    <Badge variant={member.status === "ACTIVE" ? "default" : "secondary"}>{member.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-staff-600">{formatDate(member.createdAt)}</td>
                  <td className="px-4 py-3 text-staff-600">{member.lastLoginAt ? formatDate(member.lastLoginAt) : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setResetMemberId(member.id)}
                      >
                        Reset password
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={member.status === "ACTIVE" ? "destructive" : "default"}
                        onClick={() =>
                          setPendingConfirm({
                            title: member.status === "ACTIVE" ? "Disable account?" : "Re-enable account?",
                            description:
                              member.status === "ACTIVE"
                                ? `${member.username} will no longer be able to sign in.`
                                : `${member.username} will be able to sign in again.`,
                            variant: member.status === "ACTIVE" ? "destructive" : "default",
                            action: () => {
                              const formData = new FormData()
                              formData.set("memberId", member.id)
                              formData.set("nextStatus", member.status === "ACTIVE" ? "DISABLED" : "ACTIVE")
                              void runAction(
                                () => updateCaptionWriterStatusAction(formData),
                                member.status === "ACTIVE" ? "Account disabled" : "Account enabled",
                              )
                            },
                          })
                        }
                      >
                        {member.status === "ACTIVE" ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {resetMemberId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            className={cn("w-full max-w-md rounded-lg border border-staff-200 bg-white p-5 shadow-xl")}
            action={async (formData) => {
              formData.set("memberId", resetMemberId)
              await runAction(() => resetCaptionWriterPasswordAction(formData), "Password reset")
              setResetMemberId(null)
            }}
          >
            <h3 className="text-lg font-semibold text-staff-950">Reset password</h3>
            <p className="mt-1 text-sm text-muted-foreground">Set a new password for this caption writer.</p>
            <label className="mt-4 block space-y-1 text-sm">
              <span className="font-medium text-staff-900">New password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-md border border-staff-200 px-3 py-2"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResetMemberId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Save password
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        variant={pendingConfirm?.variant ?? "default"}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          pendingConfirm?.action()
          setPendingConfirm(null)
        }}
      />
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}
