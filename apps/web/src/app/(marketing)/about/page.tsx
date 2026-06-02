import Link from "next/link"
import { ArrowRight } from "lucide-react"

export const metadata = {
  title: "About — Fotocorp",
  description: "A focused archive for editorial and commercial image discovery. Learn about Fotocorp's mission, technology, and collection.",
}

export default function AboutPage() {
  return (
    <article className="mx-auto w-full max-w-[1400px] px-4 py-12 md:py-20 sm:px-6 lg:px-8 bg-white text-black">
      {/* Eyebrow */}
      <span className="fc-display-xs text-xs tracking-[0.2em] font-semibold text-black uppercase font-sans">
        Fotocorp Archive
      </span>

      {/* Main Display Headline */}
      <h1 className="fc-display-lg mt-3 max-w-4xl text-black font-normal leading-[1.1] tracking-tight">
        A living record of history, preserved in high-resolution detail.
      </h1>

      {/* Editorial Byline/Metadata */}
      <div className="fc-byline mt-6 flex flex-wrap items-center gap-x-3 text-xs uppercase tracking-wider text-[#757575] border-b border-[#e0e0e0] pb-6 mb-12">
        <span className="font-bold font-serif italic text-black">By the Editorial Board</span>
        <span className="text-[#e0e0e0] font-sans">|</span>
        <time className="font-sans">Published May 28, 2026</time>
      </div>

      {/* Grid Layout for Story and Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
        {/* Story Columns */}
        <div className="lg:col-span-2 space-y-8">
          <p className="fc-body-serif-lg text-black font-normal leading-[1.5] tracking-wide">
            Fotocorp operates as a premium editorial and commercial image archive, serving as the trusted repository for a legacy catalog of over one million high-resolution photographs. Our collection captures the cultural, political, sporting, and social milestones of our time, documenting historic moments with visual authenticity and rigorous cataloging standards.
          </p>

          <div className="border-t border-[#e0e0e0] pt-8">
            <h2 className="fc-display-sm text-black font-normal mb-4">
              Preserving the Legacy
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed mb-4">
              Every image in our catalog is preserved with its original metadata and legacy identifiers. Values like the <strong className="text-black font-bold font-sans">Fotokey</strong> and <strong className="text-black font-bold font-sans">ImageCode</strong> remain first-class business identifiers in our system, ensuring that historic catalogs and research logs map accurately to our modernized digital storefront.
            </p>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              We leverage cloud-scale storage architectures via Cloudflare R2 to store our master originals. In public search grids, users browse lightweight, watermarked previews generated deterministically. Clean originals are only accessible through secure, server-side entitlement checks, maintaining file security without compromising on visitor discovery.
            </p>
          </div>

          <div className="border-t border-[#e0e0e0] pt-8">
            <h2 className="fc-display-sm text-black font-normal mb-4">
              Licensing and Access
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed mb-4">
              Our licensing model is strictly entitlement-based. Verified subscribers gain access to high-quality originals mapped directly to their account parameters. Non-subscribers can browse watermarked cards and thumbnails, save collections to their local <Link href="/fotobox" className="link-inline-blue">Fotobox</Link>, and request access via our dedicated inquiry workflows.
            </p>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              For teams needing comprehensive editorial or creative coverage, we offer customized download quotas and size capabilities, ensuring frictionless workflows for media outlets, publishers, and creative agencies globally.
            </p>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8 lg:border-l lg:border-[#e0e0e0] lg:pl-12">
          {/* Section: The Numbers */}
          <div>
            <h3 className="fc-display-xs text-black mb-6">
              Archive Scope
            </h3>
            <div className="space-y-6">
              <div className="border-b border-[#e0e0e0] pb-4">
                <span className="fc-display-md block text-black font-normal font-serif">1,000,000+</span>
                <span className="fc-body-sans-sm text-[#757575] mt-1 block">Preserved high-resolution images</span>
              </div>
              <div className="border-b border-[#e0e0e0] pb-4">
                <span className="fc-display-md block text-black font-normal font-serif">2.0 TB</span>
                <span className="fc-body-sans-sm text-[#757575] mt-1 block">Active secure object storage</span>
              </div>
              <div className="border-b border-[#e0e0e0] pb-4">
                <span className="fc-display-md block text-black font-normal font-serif">100+</span>
                <span className="fc-body-sans-sm text-[#757575] mt-1 block">Professional press photographers</span>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="bg-[#f5f5f5] p-6 space-y-6">
            <h4 className="fc-body-sans-strong text-black text-sm uppercase tracking-wider font-bold">
              Looking for specific coverage?
            </h4>
            <p className="fc-body-serif-md text-[#1a1a1a] text-sm leading-relaxed">
              Search our indexed collections by event, photographer, category, or historic keyword.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <Link href="/search" className="button-primary-square inline-flex items-center justify-center gap-2">
                Search Archive <ArrowRight size={16} />
              </Link>
              <Link href="/request-access" className="button-outline-square inline-flex items-center justify-center gap-2">
                Request Access <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Full-width Section: Editorial Standards */}
      <div className="border-t border-[#e0e0e0] mt-16 pt-12">
        <h3 className="fc-display-xs text-black mb-8">
          Editorial Framework
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border-r border-[#e0e0e0] pr-8 last:border-r-0">
            <h4 className="fc-body-sans-strong text-black font-bold mb-2">Authenticity</h4>
            <p className="fc-body-serif-md text-[#1a1a1a] text-sm leading-relaxed">
              We never manipulate or alter our editorial photo journalism. Every image represents a true and accurate documentation of the scene.
            </p>
          </div>
          <div className="border-r border-[#e0e0e0] pr-8 last:border-r-0">
            <h4 className="fc-body-sans-strong text-black font-bold mb-2">Preservation</h4>
            <p className="fc-body-serif-md text-[#1a1a1a] text-sm leading-relaxed">
              Metadata, capture details, location timestamps, and photographer credits are permanently bound to the asset during ingestion.
            </p>
          </div>
          <div>
            <h4 className="fc-body-sans-strong text-black font-bold mb-2">Availability</h4>
            <p className="fc-body-serif-md text-[#1a1a1a] text-sm leading-relaxed">
              Subscribers benefit from our redundant storage architecture, delivering original access via optimized delivery servers.
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}
