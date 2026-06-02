import Link from "next/link"

export const metadata = {
  title: "Privacy Policy — Fotocorp",
  description: "Learn how Fotocorp handles and protects user, subscriber, and contributor profile data.",
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-[1400px] px-4 py-12 md:py-20 sm:px-6 lg:px-8 bg-white text-black">
      <span className="fc-display-xs text-xs tracking-[0.2em] font-semibold text-black uppercase font-sans">
        Legal Documents
      </span>

      <h1 className="fc-display-lg mt-3 max-w-4xl text-black font-normal leading-[1.1] tracking-tight">
        Privacy Policy
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
              1. Information We Collect
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              We collect information to authenticate users, manage licensing inquiries, and enforce download quotas. Better Auth manages core credentials and sessions (emails, passwords, and lowercase usernames). Registration details, such as interested asset types and organization profiles, are stored separately in user profiles.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="fc-display-sm text-black font-normal border-b border-[#e0e0e0] pb-3">
              2. Download and Download Logs
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              To support license verification and quota management, we maintain detailed download logs containing timestamp records and associated download size parameters. This activity logging is essential to verify subscriber compliance with quality caps and entitlement quotas.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="fc-display-sm text-black font-normal border-b border-[#e0e0e0] pb-3">
              3. Data Security & Storage Boundaries
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              Fotocorp secures original high-resolution assets within Cloudflare R2 object storage. Original file storage keys, bucket names, and direct URLs are kept strictly confidential behind our server-side proxy tunnels and are never exposed to browser-visible payloads.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="fc-display-sm text-black font-normal border-b border-[#e0e0e0] pb-3">
              4. Contributor Information
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              For photographers and contributors, session and upload activity are managed securely under separate contributor boundaries. We collect upload batches and associate event metadata with numeric photographer IDs to preserve catalog integrity.
            </p>
          </section>
        </div>

        <div className="space-y-8 lg:border-l lg:border-[#e0e0e0] lg:pl-12">
          <div>
            <h3 className="fc-display-xs text-black mb-6">
              Security
            </h3>
            <p className="fc-body-serif-md text-sm text-[#757575] leading-relaxed">
              Your credentials are encrypted using industry-standard hashing algorithms. We restrict internal staff access to subscriber entitlements through hashed sessions and staff audit logs.
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}
