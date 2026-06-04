import { Search } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

export default function AssetDetailLoading() {
  return (
    <div className="bg-background pb-20 lg:pb-0" aria-busy="true" aria-label="Loading asset">
      <div className="bg-surface-warm/70">
        <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 lg:px-8">
          <div className="flex min-h-12 items-center gap-3 rounded-none border border-border-strong bg-background px-4 shadow-sm">
            <Search className="shrink-0 text-muted-foreground/50" aria-hidden size={20} />
            <Skeleton className="h-4 min-w-0 flex-1 rounded-none" />
            <Skeleton className="hidden h-4 w-28 rounded-none sm:block" />
            <Skeleton className="h-9 w-20 rounded-none" />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 pt-3 pb-5 sm:px-5 lg:px-8 lg:pt-4 lg:pb-7">
        <div className="mb-7 flex flex-wrap items-center gap-2 lg:mb-8">
          <Skeleton className="h-4 w-32 rounded-none" />
          <Skeleton className="h-4 w-px rounded-none" />
          <Skeleton className="h-4 w-24 rounded-none" />
          <Skeleton className="h-4 w-px rounded-none" />
          <Skeleton className="h-4 w-36 rounded-none" />
        </div>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(340px,0.58fr)] lg:items-stretch">
          <section className="min-w-0 space-y-5 lg:flex lg:min-h-0 lg:flex-col lg:gap-5">
            <header className="shrink-0 space-y-3">
              <Skeleton className="h-9 w-full max-w-3xl rounded-none sm:h-10 lg:h-12" />
              <Skeleton className="h-3 w-48 rounded-none" />
              <div className="space-y-2 pt-1">
                <Skeleton className="h-4 w-full max-w-4xl rounded-none" />
                <Skeleton className="h-4 w-full max-w-3xl rounded-none" />
                <Skeleton className="h-4 w-2/3 max-w-2xl rounded-none" />
              </div>
            </header>

            <div className="mt-1 border-b border-border pb-4 lg:hidden">
              <Skeleton className="mb-2 h-3 w-40 rounded-none" />
              <div className="flex gap-2 overflow-hidden">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-[4/3] h-14 shrink-0 rounded-none" />
                ))}
              </div>
            </div>

            <figure className="overflow-hidden bg-background lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <div className="flex w-full flex-col bg-background px-4 pb-4 pt-2 sm:px-5 sm:pb-5 sm:pt-2 lg:min-h-[min(72vh,820px)] lg:flex-1 lg:px-6 lg:pb-6 lg:pt-2">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <Skeleton className="h-7 w-7 rounded-none" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-24 rounded-none" />
                    <Skeleton className="h-8 w-20 rounded-none" />
                  </div>
                </div>
                <Skeleton className="mt-4 min-h-[min(52vh,640px)] w-full flex-1 rounded-none lg:min-h-0" />
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <Skeleton className="h-9 w-9 rounded-none" />
                  <Skeleton className="h-4 w-28 rounded-none" />
                  <Skeleton className="h-9 w-9 rounded-none" />
                </div>
              </div>
            </figure>
          </section>

          <aside className="scroll-mt-28 space-y-6 lg:sticky lg:top-24">
            <div className="space-y-6 rounded-none border border-border bg-white p-5 sm:p-6">
              <Skeleton className="h-5 w-56 rounded-none" />
              <div className="overflow-hidden rounded-none border border-border">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className={index > 0 ? "border-t border-border px-4 py-3" : "px-4 py-3"}
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-16 rounded-none" />
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className="h-12 w-full rounded-none" />
              <div className="border-t border-border/60 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <Skeleton className="h-4 w-36 rounded-none" />
                  <Skeleton className="h-3 w-16 rounded-none" />
                </div>
                <div className="grid max-h-[min(40vh,420px)] grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-[4/3] w-full rounded-none" />
                  ))}
                </div>
              </div>
              <div className="space-y-2 border-t border-border pt-5">
                <Skeleton className="h-3 w-16 rounded-none" />
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] gap-x-4">
                    <Skeleton className="h-3 w-full rounded-none" />
                    <Skeleton className="h-3 w-3/4 rounded-none" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-6 scroll-mt-28 border-t border-border pt-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <Skeleton className="h-8 w-64 rounded-none" />
            <Skeleton className="h-4 w-24 rounded-none" />
            <Skeleton className="h-4 w-16 rounded-none" />
          </div>
          <div className="mt-6 w-full">
            {Array.from({ length: 3 }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="flex w-full"
                style={{ gap: 8, height: 200, marginBottom: 8 }}
              >
                <Skeleton className="h-full flex-[3] rounded-none" />
                <Skeleton className="h-full flex-[2] rounded-none" />
                <Skeleton className="h-full flex-1 rounded-none" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white p-3 shadow-md lg:hidden">
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-none" />
          <Skeleton className="h-10 flex-1 rounded-none" />
        </div>
      </div>
    </div>
  )
}
