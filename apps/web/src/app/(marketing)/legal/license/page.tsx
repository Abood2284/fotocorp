import Link from "next/link"

export const metadata = {
  title: "License Agreement — Fotocorp",
  description: "Terms and conditions for content licensing on the Fotocorp editorial stock image platform.",
}

export default function LicensePage() {
  return (
    <article className="mx-auto w-full max-w-[1400px] px-4 py-12 md:py-20 sm:px-6 lg:px-8 bg-white text-black">
      <span className="fc-display-xs text-xs tracking-[0.2em] font-semibold text-black uppercase font-sans">
        Legal Documents
      </span>

      <h1 className="fc-display-lg mt-3 max-w-4xl text-black font-normal leading-[1.1] tracking-tight">
        Content License Agreement
      </h1>

      <div className="fc-byline mt-6 flex flex-wrap items-center gap-x-3 text-xs uppercase tracking-wider text-[#757575] border-b border-[#e0e0e0] pb-6 mb-12">
        <span className="font-bold font-serif italic text-black">Compliance Desk</span>
        <span className="text-[#e0e0e0] font-sans">|</span>
        <time className="font-sans">Effective May 28, 2026</time>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
        <div className="lg:col-span-2 space-y-12">
          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="fc-display-sm text-black font-normal border-b border-[#e0e0e0] pb-3">
              1. Grant of License
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              All digital image assets obtained from the Fotocorp archive are licensed on a non-exclusive, non-transferable, revocable basis, subject to approved user entitlements. Standard licensing permits editorial usage inside publications, digital broadcasts, and commercial campaigns according to the quota and size capabilities activated on your profile.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="fc-display-sm text-black font-normal border-b border-[#e0e0e0] pb-3">
              2. Watermarked Comps & Previews
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              Unauthenticated visitors may view watermarked cards, thumbnails, and detail previews. These previews are strictly for evaluation, layout draft, or mock-up purposes. Any public exhibition, redistribution, or digital display of watermarked preview assets is strictly prohibited and constitutes copyright infringement.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="fc-display-sm text-black font-normal border-b border-[#e0e0e0] pb-3">
              3. Entitlements and Downloads
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              Downloads of unwatermarked, high-resolution original files require an active profile entitlement provisioned by our sales desk. Each download request is authorized server-side and logged against your licensing allotment. Sharing credentials, bypassing entitlement checks, or caching original files outside of the authorized user profile violates this agreement.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="fc-display-sm text-black font-normal border-b border-[#e0e0e0] pb-3">
              4. Prohibited Uses
            </h2>
            <ul className="list-decimal pl-5 space-y-2 fc-body-serif-md text-[#1a1a1a]">
              <li>Use of editorial assets in commercial merchandise or retail packaging without explicit secondary clearance.</li>
              <li>Sub-licensing, redistributing, or assigning original assets to third-party marketplaces or external agencies.</li>
              <li>Bypassing copyright marks, metadata attributes, or legacy identifiers (e.g. Fotokey or ImageCode) attached to the media.</li>
              <li>Feeding licensed assets into machine learning algorithms or vector database indexing without specialized enterprise contracts.</li>
            </ul>
          </section>
        </div>

        <div className="space-y-8 lg:border-l lg:border-[#e0e0e0] lg:pl-12">
          <div>
            <h3 className="fc-display-xs text-black mb-6">
              Summary
            </h3>
            <p className="fc-body-serif-md text-sm text-[#757575] leading-relaxed">
              Our licensing model protects the intellectual property of our 100+ contributed photographers. All usage is mapped to active, sales-authorized profiles. For specialized clearances or to adjust download quality caps, contact our licensing desk.
            </p>
          </div>
          
          <div className="bg-[#f5f5f5] p-6 space-y-4 font-sans text-xs">
            <h4 className="fc-body-sans-strong text-black font-bold uppercase tracking-wider">
              Licensing Questions?
            </h4>
            <p className="text-[#1a1a1a] leading-relaxed">
              If you require a custom pricing agreement or need to increase your quota allotment, contact us directly.
            </p>
            <Link href="/contact" className="button-primary-square text-center block text-sm w-full py-2">
              Contact Licensing Desk
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
