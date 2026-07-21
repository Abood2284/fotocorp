import Link from "next/link"
import { ArrowRight } from "lucide-react"

export const metadata = {
  title: "Services — Fotocorp",
  description:
    "Enterprise licensing, archival research, and editorial image services tailored to your needs.",
}

export default function ServicesPage() {
  return (
    <article className="mx-auto w-full max-w-[1400px] px-4 py-12 md:py-20 sm:px-6 lg:px-8 bg-white text-black">
      <h1 className="fc-display-lg max-w-4xl text-black font-normal leading-[1.1] tracking-tight">
        Services
      </h1>

      <p className="fc-body-serif-md mt-12 text-[#1a1a1a] leading-relaxed mb-12 max-w-3xl">
        Enterprise licensing, archival research, and editorial image services tailored to your needs.
      </p>

      {/* Services Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 pb-12">
        <div className="space-y-4 md:border-r md:border-[#e0e0e0] md:pr-8 md:[&:nth-child(3n)]:border-r-0">
          <h2 className="fc-display-sm text-black font-normal">Archive Licensing</h2>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Gain access to commercial and editorial licensing for our archive of more than one million
            high-resolution images.
          </p>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Watermarked preview images are available for research, layout drafts, and internal review.
            Once licensed, you can securely download high-resolution, unwatermarked master files through
            your account.
          </p>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Our licensing agreements are tailored to your organization&apos;s needs, with volume-based
            pricing and account-specific usage rights that provide transparent access and predictable
            costs.
          </p>
        </div>

        <div className="space-y-4 md:border-r md:border-[#e0e0e0] md:pr-8 md:[&:nth-child(3n)]:border-r-0">
          <h2 className="fc-display-sm text-black font-normal">Archival Research</h2>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            For complex research requests and unindexed archive collections, our team of archivists and
            photo editors provides expert archival research, database mapping, and advanced image
            discovery services.
          </p>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            We trace legacy identifiers, locate original photographer archives, and reconcile metadata
            records to identify and retrieve historic images and supporting documentation tailored to your
            organization&apos;s editorial, commercial, or creative needs.
          </p>
        </div>

        <div className="space-y-4 md:border-r md:border-[#e0e0e0] md:pr-8 md:[&:nth-child(3n)]:border-r-0">
          <h2 className="fc-display-sm text-black font-normal">Editorial Assignments</h2>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Commission our nationwide network of more than 100 professional press and sports photographers
            for bespoke editorial coverage of news, sports, corporate, and special events across India.
          </p>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Images are securely delivered directly to your workspace through our editorial delivery
            platform. Our rapid ingestion and editing workflows ensure approved, publication-ready images
            are available within minutes of capture, enabling your team to meet even the tightest
            publishing deadlines.
          </p>
        </div>

        <div className="space-y-4 md:border-r md:border-[#e0e0e0] md:pr-8 md:[&:nth-child(3n)]:border-r-0">
          <h2 className="fc-display-sm text-black font-normal">
            Creative Illustrations & Editorial Cartoons
          </h2>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            From editorial illustrations and political cartoons to custom artwork for corporate
            communications, advertising campaigns, and branded content, our team creates original visuals
            that communicate ideas with clarity, creativity, and impact. Every illustration is crafted to
            engage audiences across print, digital, and social media platforms.
          </p>
        </div>

        <div className="space-y-4 md:border-r md:border-[#e0e0e0] md:pr-8 md:[&:nth-child(3n)]:border-r-0">
          <h2 className="fc-display-sm text-black font-normal">Paparazzi Video</h2>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Access exclusive celebrity, entertainment, and event footage captured by our global network of
            professional photographers and videographers. Our paparazzi video archive delivers timely,
            high-quality content to media outlets, publishers, broadcasters, and digital platforms
            worldwide.
          </p>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            From breaking celebrity moments and red-carpet appearances to entertainment coverage and
            exclusive events, our collection provides ready-to-license footage for editorial, commercial,
            and digital media use.
          </p>
        </div>

        <div className="space-y-4 md:border-r md:border-[#e0e0e0] md:pr-8 md:[&:nth-child(3n)]:border-r-0">
          <h2 className="fc-display-sm text-black font-normal">Royalty-Free Image Collection</h2>
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
            Explore our curated collection of high-resolution royalty-free images, available through
            flexible licensing for commercial, corporate, editorial, and digital use. Carefully selected
            for quality and versatility, our library provides premium visual assets that elevate campaigns,
            publications, websites, presentations, and creative projects.
          </p>
        </div>
      </div>

      {/* Call to Action Box */}
      <div className="bg-[#f5f5f5] p-8 md:p-12 mt-4 space-y-6">
        <h3 className="fc-display-md text-black font-normal max-w-2xl leading-snug">
          Looking to configure a licensing framework for your team?
        </h3>
        <p className="fc-body-serif-md text-[#1a1a1a] max-w-3xl leading-relaxed">
          We work with newsrooms, commercial publishers, agencies, and independent creators to provide
          licensing solutions tailored to their specific requirements. Each agreement is customized based
          on your intended usage, access requirements, and content needs.
        </p>
        <p className="fc-body-serif-md text-[#1a1a1a] max-w-3xl leading-relaxed">
          Create an account and submit your request to begin a consultation with our licensing team.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <Link
            href="/request-access"
            className="button-primary-square inline-flex items-center justify-center gap-2 px-8"
          >
            Register for Access <ArrowRight size={16} />
          </Link>
          <Link
            href="/contact"
            className="button-outline-square inline-flex items-center justify-center gap-2 px-8"
          >
            Contact Archive Desk <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Step-by-Step Workflow Section */}
      <div className="border-t border-[#e0e0e0] pt-12 mt-12">
        <h3 className="fc-display-xs text-black mb-8">Access & Licensing Process</h3>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 border-b border-[#e0e0e0] pb-6 last:border-b-0">
            <span className="fc-display-md text-black font-normal font-serif md:col-span-1">
              01 / Register
            </span>
            <div className="md:col-span-3 space-y-2">
              <h4 className="fc-body-sans-strong text-black font-bold uppercase tracking-wide text-sm">
                Request an Access Profile
              </h4>
              <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
                Complete the Access Request form with details about your organization, the image categories
                you require, your intended use, and your anticipated download volume. Our team will review
                your application and recommend the most appropriate access level and licensing solution for
                your needs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 border-b border-[#e0e0e0] pb-6 last:border-b-0">
            <span className="fc-display-md text-black font-normal font-serif md:col-span-1">
              02 / Review & Consultation
            </span>
            <div className="md:col-span-3 space-y-2">
              <h4 className="fc-body-sans-strong text-black font-bold uppercase tracking-wide text-sm">
                Licensing Consultation & Pricing
              </h4>
              <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
                Once we&apos;ve reviewed your request, a member of our licensing team will contact you to
                discuss your organization&apos;s requirements and recommend a licensing solution tailored to
                your needs. Pricing is based on your intended usage, access level, image volume, and
                licensing requirements, ensuring a flexible agreement that delivers the right level of
                access and value.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 pb-6 last:border-b-0">
            <span className="fc-display-md text-black font-normal font-serif md:col-span-1">
              03 / Activate
            </span>
            <div className="md:col-span-3 space-y-2">
              <h4 className="fc-body-sans-strong text-black font-bold uppercase tracking-wide text-sm">
                Account Activation & Access
              </h4>
              <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
                Once your application has been approved, your account will be activated with the
                appropriate licensing permissions and access privileges. Your download quota, image access
                level, and licensing rights will be configured according to your agreement, enabling
                immediate access to browse, license, and download high-resolution images.
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
