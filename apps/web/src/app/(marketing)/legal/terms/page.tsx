import Link from "next/link"

export const metadata = {
  title: "Terms of Use — Fotocorp",
  description: "Terms and rules governing the use of the Fotocorp editorial stock image platform.",
}

export default function TermsPage() {
  return (
    <article className="mx-auto w-full max-w-[1400px] px-4 py-12 md:py-20 sm:px-6 lg:px-8 bg-white text-black">
      <span className="fc-display-xs text-xs tracking-[0.2em] font-semibold text-black uppercase font-sans">
        Legal Documents
      </span>

      <h1 className="fc-display-lg mt-3 max-w-4xl text-black font-normal leading-[1.1] tracking-tight">
        Terms of Use
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
              1. Acceptable Platform Use
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              The Fotocorp platform and its archive search indexing are provided for news organizations, publishers, and commercial licensing partners. By creating an account, you agree to provide accurate registration information, maintain profile security, and use search facets exclusively for catalog discovery.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="fc-display-sm text-black font-normal border-b border-[#e0e0e0] pb-3">
              2. Account Credentials & Validation
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              We require usernames and business emails for account verification. Registration requests are evaluated based on business credentials, disposable email checks, and MX domain record validation. Accounts displaying incorrect credentials or unauthorized sharing of session credentials may be suspended immediately.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="fc-display-sm text-black font-normal border-b border-[#e0e0e0] pb-3">
              3. Copyright Notice & Legacy Identifiers
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              All material in the archive, including watermarked images, is copyrighted by Fotocorp and its contributing photographers. Legacy photo codes, event descriptions, and photographers' names are business identifiers that must remain searchable and displayed in their canonical format.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="fc-display-sm text-black font-normal border-b border-[#e0e0e0] pb-3">
              4. Entitlement Gating & Abuse
            </h2>
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              We enforce download limits, quality caps, and subscription validations. Any attempt to scrape image grids, bypass preview routes, download raw originals using forged headers, or automate catalog indexing is a violation of these terms and will result in immediate suspension and loss of access.
            </p>
          </section>
        </div>

        <div className="space-y-8 lg:border-l lg:border-[#e0e0e0] lg:pl-12">
          <div>
            <h3 className="fc-display-xs text-black mb-6">
              Compliance
            </h3>
            <p className="fc-body-serif-md text-sm text-[#757575] leading-relaxed">
              Platform terms are subject to change. Subscribers will be notified of major policy changes. Unauthorized activity or data scraping constitutes a violation of platform integrity.
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}
