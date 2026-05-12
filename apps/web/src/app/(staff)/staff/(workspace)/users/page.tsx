import { Users } from "lucide-react"
import { revalidatePath } from "next/cache"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { listInternalAdminUsers, updateInternalAdminUserSubscription } from "@/lib/api/admin-assets-api"

export const metadata = {
  title: "Users",
}

export default async function AdminUsersPage() {
  const usersResponse = await listInternalAdminUsers(new URLSearchParams()).catch(() => null)
  const users = usersResponse?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">App users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fotocorp app profiles linked to Better Auth users.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Profiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length ? (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Subscriber</th>
                    <th className="px-4 py-3 font-medium">Subscription</th>
                    <th className="px-4 py-3 font-medium">Ends</th>
                    <th className="px-4 py-3 font-medium">Downloads</th>
                    <th className="px-4 py-3 font-medium">Subscription control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{user.displayName || "Unnamed user"}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded border border-border px-2 py-1 text-xs font-medium">{user.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded border border-border px-2 py-1 text-xs font-medium">{user.status}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.isSubscriber ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded border border-border px-2 py-1 text-xs font-medium">{user.subscriptionStatus}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatNullableDate(user.subscriptionEndsAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatQuota(user.downloadQuotaUsed, user.downloadQuotaLimit)}
                      </td>
                      <td className="px-4 py-3">
                        <form action={toggleSubscriptionAction} className="flex items-center gap-2">
                          <input type="hidden" name="authUserId" value={user.authUserId} />
                          <input type="hidden" name="nextState" value={user.isSubscriber ? "false" : "true"} />
                          <button
                            type="submit"
                            className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                          >
                            {user.isSubscriber ? "Turn subscription off" : "Turn subscription on"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
              No app profiles exist yet. Profiles are created when authenticated users access protected app areas.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

async function toggleSubscriptionAction(formData: FormData) {
  "use server"

  const authUserId = String(formData.get("authUserId") ?? "").trim()
  const nextState = String(formData.get("nextState") ?? "").trim() === "true"

  if (!authUserId) return
  await updateInternalAdminUserSubscription(authUserId, { isSubscriber: nextState })
  revalidatePath("/staff/users")
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function formatNullableDate(date: string | null) {
  if (!date) return "None"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return "None"
  return formatDate(parsed)
}

function formatQuota(used: number, limit: number | null) {
  return limit === null ? `${used} / unlimited` : `${used} / ${limit}`
}
