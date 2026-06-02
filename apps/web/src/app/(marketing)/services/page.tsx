import Link from "next/link"
import { ArrowRight } from "lucide-react"

export const metadata = {
  title: "Services — Fotocorp",
  description: "Explore Fotocorp's editorial solutions: archive media licensing, custom photography assignment, and legacy database research.",
}

export default function ServicesPage() {
  return (
    <article className="mx-auto w-full max-w-[1400px] px-4 py-12 md:py-20 sm:px-6 lg:px-8 bg-white text-black">
      {/* Eyebrow */}
      <span className="fc-display-xs text-xs tracking-[0.2em] font-semibold text-black uppercase font-sans">
        Services & Solutions
      </span>

      {/* Main Display Headline */}
      <h1 className="fc-display-lg mt-3 max-w-4xl text-black font-normal leading-[1.1] tracking-tight">
        Tailored media licensing, archival research, and press coverage.
      </h1>

      {/* Editorial Byline/Metadata */}
      <div className="fc-byline mt-6 flex flex-wrap items-center gap-x-3 text-xs uppercase tracking-wider text-[#757575] border-b border-[#e0e0e0] pb-6 mb-12">
        <span className="font-bold font-serif italic text-black">Licensing Desk</span>
        <span className="text-[#e0e0e0] font-sans">|</span>
        <time className="font-sans">Updated May 28, 2026</time>
      </div>

      {/* Services Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 pb-12">
        {/* Service 1 */}
        <div className="space-y-4 md:border-r md:border-[#e0e0e0] md:pr-8 last:border-r-0">
          <h2 className="fc-display-sm text-black font-normal">
            Archive Licensing
          </h2>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Gain commercial and editorial rights to our collection of over one million high-resolution images. We provide safe preview watermarks for drafting layouts, with unwatermarked master file downloads accessible via secure, server-side tunnels.
          </p>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Licensing agreements are volume-based and entitlement-driven, mapped directly to your account parameters to prevent overage charges or unexpected fees.
          </p>
        </div>

        {/* Service 2 */}
        <div className="space-y-4 md:border-r md:border-[#e0e0e0] md:pr-8 last:border-r-0">
          <h2 className="fc-display-sm text-black font-normal">
            Archival Research
          </h2>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            For complex research requests or unindexed catalog folders, our team of archivist editors provides database mapping and search mapping services.
          </p>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            We inspect legacy identifiers, locate photographer rolls, and reconcile metadata registries to retrieve historic documentation matching your organization's specific creative query.
          </p>
        </div>

        {/* Service 3 */}
        <div className="space-y-4 last:border-r-0">
          <h2 className="fc-display-sm text-black font-normal">
            Press Assignment
          </h2>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Commission our active network of over 100 professional press and sports photographers for custom event coverage across India.
          </p>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Assigned coverage integrates directly into your workspace. We utilize rapid ingestion and secure processing pipelines to deliver approved derivatives within minutes of event capture.
          </p>
        </div>
      </div>

      {/* Step-by-Step Workflow Section */}
      <div className="border-t border-[#e0e0e0] pt-12 mt-8">
        <h3 className="fc-display-xs text-black mb-8">
          Licensing Workflow
        </h3>
        
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 border-b border-[#e0e0e0] pb-6 last:border-b-0">
            <span className="fc-display-md text-black font-normal font-serif md:col-span-1">
              01 / Register
            </span>
            <div className="md:col-span-3 space-y-2">
              <h4 className="fc-body-sans-strong text-black font-bold uppercase tracking-wide text-sm">
                Request Access Profile
              </h4>
              <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
                Submit an inquiry via our Access Portal indicating your organization, desired asset categories, image usage intentions, and estimated download volumes.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 border-b border-[#e0e0e0] pb-6 last:border-b-0">
            <span className="fc-display-md text-black font-normal font-serif md:col-span-1">
              02 / Consult
            </span>
            <div className="md:col-span-3 space-y-2">
              <h4 className="fc-body-sans-strong text-black font-bold uppercase tracking-wide text-sm">
                Outreach & Pricing Configuration
              </h4>
              <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
                We currently do not offer standard or automated pricing plans. Instead, our licensing desk contacts you to discuss custom pricing models matching your budget constraints and entitlement criteria.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 pb-6 last:border-b-0">
            <span className="fc-display-md text-black font-normal font-serif md:col-span-1">
              03 / Activate
            </span>
            <div className="md:col-span-3 space-y-2">
              <h4 className="fc-body-sans-strong text-black font-bold uppercase tracking-wide text-sm">
                Entitlement Delivery
              </h4>
              <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
                Approved accounts receive active entitlements (specified download quota counts and quality tier authorizations) provisioned on their profiles, enabling instant high-resolution downloads.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action Box */}
      <div className="bg-[#f5f5f5] p-8 md:p-12 mt-12 space-y-6">
        <h3 className="fc-display-md text-black font-normal max-w-2xl leading-snug">
          Looking to configure a licensing framework for your team?
        </h3>
        <p className="fc-body-serif-md text-[#1a1a1a] max-w-3xl leading-relaxed">
          Because we cater to enterprise news desks, commercial publishers, and independent creators, our agreements are finalized on a case-by-case basis. Create an account and submit your parameters to begin consultation.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <Link href="/request-access" className="button-primary-square inline-flex items-center justify-center gap-2 px-8">
            Register for Access <ArrowRight size={16} />
          </Link>
          <Link href="/contact" className="button-outline-square inline-flex items-center justify-center gap-2 px-8">
            Contact Archive Desk <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  )
}
