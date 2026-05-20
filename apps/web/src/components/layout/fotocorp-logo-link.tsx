import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface FotocorpLogoLinkProps {
  className?: string
  imageClassName?: string
  priority?: boolean
}

export function FotocorpLogoLink({
  className,
  imageClassName,
  priority = false,
}: FotocorpLogoLinkProps) {
  return (
    <Link
      href="/"
      className={cn(
        "fc-brand flex shrink-0 items-center rounded-md py-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label="Fotocorp home"
    >
      <Image
        src="/images/fotocorp-logo.svg"
        alt=""
        width={1400}
        height={425}
        priority={priority}
        className={cn("h-7 w-auto sm:h-8", imageClassName)}
      />
    </Link>
  )
}
