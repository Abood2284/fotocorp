import { PreviewImage } from "@/components/assets/preview-image"
import type { PublicPreview } from "@/features/assets/types"
import { cn } from "@/lib/utils"

interface CaricatureProtectedPreviewProps {
  preview: PublicPreview | null
  alt: string
  className?: string
}

export function CaricatureProtectedPreview({ preview, alt, className }: CaricatureProtectedPreviewProps) {
  return (
    <figure className={cn("min-w-0", className)}>
      <div
        className={cn(
          "relative flex w-full items-center justify-center bg-background",
          !preview && "min-h-[280px]",
        )}
      >
        {preview ? (
          <PreviewImage
            src={preview.url}
            alt={alt}
            width={preview.width}
            height={preview.height}
            className="mx-auto block h-auto w-full max-h-[min(70vh,900px)] max-w-full object-contain"
            loading="eager"
          />
        ) : (
          <p className="px-6 text-center text-sm text-muted-foreground">
            Preview is being prepared.
          </p>
        )}
      </div>
    </figure>
  )
}
