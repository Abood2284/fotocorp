import Link from "next/link"
import { LockKeyhole } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

export const metadata = {
  title: "Unauthorized",
}

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16 text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <LockKeyhole className="h-6 w-6" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">You do not have access to this area.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your Fotocorp role does not include permission for the requested workspace.
      </p>
      <div className="mt-6">
        <Link href="/account" className={buttonVariants()}>
          View account
        </Link>
      </div>
    </main>
  )
}
