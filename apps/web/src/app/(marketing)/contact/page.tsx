import Link from "next/link"
import { Mail, Phone, MapPin } from "lucide-react"
import { ContactForm } from "@/components/marketing/contact-form"

export const metadata = {
  title: "Contact — Fotocorp",
  description: "Get in touch with Fotocorp. Contact our editorial archive team, request licensing support, or reach corporate headquarters.",
}

export default function ContactPage() {
  return (
    <article className="mx-auto w-full max-w-[1400px] px-4 py-12 md:py-20 sm:px-6 lg:px-8 bg-white text-black">
      {/* Eyebrow */}
      <span className="fc-display-xs text-xs tracking-[0.2em] font-semibold text-black uppercase font-sans">
        Inquiries
      </span>

      {/* Main Display Headline */}
      <h1 className="fc-display-lg mt-3 max-w-4xl text-black font-normal leading-[1.1] tracking-tight">
        Connect with our archive editors, licensing agents, and support desks.
      </h1>

      {/* Editorial Byline/Metadata */}
      <div className="fc-byline mt-6 flex flex-wrap items-center gap-x-3 text-xs uppercase tracking-wider text-[#757575] border-b border-[#e0e0e0] pb-6 mb-12">
        <span className="font-bold font-serif italic text-black">Inquiry Desk</span>
        <span className="text-[#e0e0e0] font-sans">|</span>
        <time className="font-sans">Updated May 28, 2026</time>
      </div>

      {/* Grid Layout for Form and Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
        {/* Contact Form Column */}
        <div className="lg:col-span-2 space-y-6">
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed mb-6">
            If you are requesting custom license permissions, searching for unindexed legacy assets, or require account assistance, please use the form below. For direct desk contacts, refer to the directories.
          </p>
          <ContactForm />
        </div>

        {/* Support Directory Sidebar */}
        <div className="space-y-8 lg:border-l lg:border-[#e0e0e0] lg:pl-12">
          <div>
            <h3 className="fc-display-xs text-black mb-6">
              Directories
            </h3>
            <div className="space-y-6">
              {/* Archive Desk */}
              <div className="border-b border-[#e0e0e0] pb-4 space-y-2">
                <span className="fc-body-sans-strong block uppercase tracking-wider text-sm font-bold text-black">
                  Archive Desk
                </span>
                <p className="fc-body-serif-md text-sm text-[#1a1a1a] leading-relaxed">
                  For assistance with legacy photo mapping, batch ingestion, or metadata queries:
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-[#757575]" />
                  <a href="mailto:archive@fotocorp.com" className="link-inline-blue font-sans">
                    archive@fotocorp.com
                  </a>
                </div>
              </div>

              {/* Licensing Desk */}
              <div className="border-b border-[#e0e0e0] pb-4 space-y-2">
                <span className="fc-body-sans-strong block uppercase tracking-wider text-sm font-bold text-black">
                  Licensing & Sales
                </span>
                <p className="fc-body-serif-md text-sm text-[#1a1a1a] leading-relaxed">
                  For subscription pricing, enterprise usage agreements, and custom commercial rights:
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-[#757575]" />
                  <a href="mailto:licensing@fotocorp.com" className="link-inline-blue font-sans">
                    licensing@fotocorp.com
                  </a>
                </div>
              </div>

              {/* Corporate Head office */}
              <div className="pb-4 space-y-2">
                <span className="fc-body-sans-strong block uppercase tracking-wider text-sm font-bold text-black">
                  Headquarters
                </span>
                <p className="fc-body-serif-md text-sm text-[#1a1a1a] leading-relaxed">
                  Fotocorp Media Private Limited
                </p>
                <div className="space-y-1 text-sm font-sans text-[#757575]">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="mt-1 shrink-0 text-[#757575]" />
                    <span>
                      Nariman Point, Mumbai,<br />
                      Maharashtra 400021, India
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Phone size={14} className="text-[#757575]" />
                    <span>+91 22 5555 0199</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
