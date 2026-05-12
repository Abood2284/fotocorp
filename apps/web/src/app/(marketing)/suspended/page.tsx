import Link from "next/link"
import { CircleAlert } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

export const metadata = {
  title: "Account Suspended",
}

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16 text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-destructive/10 text-destructive">
        <CircleAlert className="h-6 w-6" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Your account is suspended.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Suspended Fotocorp accounts cannot access protected areas. Contact an administrator if this is unexpected.
      </p>
      <div className="mt-6">
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Return home
        </Link>
      </div>
    </main>
  )
}
