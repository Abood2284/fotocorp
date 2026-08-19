import { ContextualHelpLinks } from "@/components/staff/help/contextual-help-links"
import { getContributorHelpLinkItems } from "@/lib/contributor-help"
import { normalizeContributorUploadTypes } from "@/lib/contributors/allowed-upload-types"
import { cn } from "@/lib/utils"

interface ContributorHelpLinksProps {
  allowedUploadTypes: readonly string[]
  className?: string
}

export function ContributorHelpLinks({ allowedUploadTypes, className }: ContributorHelpLinksProps) {
  const items = getContributorHelpLinkItems(normalizeContributorUploadTypes(allowedUploadTypes))
  return <ContextualHelpLinks items={items} compact className={cn("max-w-sm", className)} />
}
