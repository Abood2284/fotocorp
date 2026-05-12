import Link from "next/link"
import { ArrowRight, Images } from "lucide-react"
import type { PublicAssetCollection } from "@/features/assets/types"
import { PreviewImage } from "@/components/assets/preview-image"
import { EmptyState } from "@/components/shared/empty-state"

interface PublicCollectionsProps {
  collections: PublicAssetCollection[]
}

export function PublicCollections({ collections }: PublicCollectionsProps) {
  if (collections.length === 0) {
    return (
      <EmptyState
        icon={Images}
        title="Collections are being prepared"
        description="Category previews will appear once public watermarked images are ready."
        className="rounded-lg border border-border bg-muted/20"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[300px]">
      {collections.map((collection, index) => (
        <Link
          key={collection.id}
          href={`/search?categoryId=${encodeURIComponent(collection.id)}`}
          className={`group relative overflow-hidden rounded-xl bg-muted ${index === 0 || index === 5 ? "lg:col-span-2 lg:row-span-2" : ""}`}
        >
          {collection.preview ? (
            <PreviewImage
              src={collection.preview.url}
              alt={collection.name}
              className="h-full min-h-[250px] w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
            />
          ) : (
            <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-muted-foreground">
              Preview unavailable
            </div>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(0,0,0,0.8)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-white drop-shadow-md">{collection.name}</h3>
              <p className="mt-1 text-xs font-medium text-white/90 drop-shadow-sm">
                {collection.assetCount.toLocaleString()} public images
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-white/80 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      ))}
    </div>
  )
}
