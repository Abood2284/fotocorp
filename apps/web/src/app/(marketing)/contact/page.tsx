import { Mail, MapPin } from "lucide-react"
import { ContactForm } from "@/components/marketing/contact-form"

export const metadata = {
  title: "Contact — Fotocorp",
  description:
    "Need custom licensing, help finding images in our archives or account support? Get in touch with the Fotocorp team.",
}

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0 text-[#757575]"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
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
        Contact Us
      </h1>

      {/* Grid Layout for Form and Sidebar */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
        {/* Contact Form Column */}
        <div className="lg:col-span-2 space-y-6">
          <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed mb-6">
            Need custom licensing, help finding images in our archives or account support? Complete the
            form below to get in touch with our team. For direct editorial desk contacts, please refer to
            our directories.
          </p>
          <ContactForm />
        </div>

        {/* Support Directory Sidebar */}
        <div className="space-y-8 lg:border-l lg:border-[#e0e0e0] lg:pl-12">
          {/* Headquarters — above Directories */}
          <div className="space-y-2">
            <span className="fc-body-sans-strong block uppercase tracking-wider text-sm font-bold text-black">
              Mumbai Office
            </span>
            <div className="space-y-2 text-sm font-sans text-[#757575]">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-1 shrink-0 text-[#757575]" />
                <span>
                  Primrose Chambers, 49, Jijibhai Dadabhai Lane, Fort, Mumbai-400001. INDIA
                </span>
              </div>
              <div className="flex items-center gap-2">
                <WhatsAppIcon size={14} />
                <a
                  href="https://wa.me/917666686655"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-inline-blue font-sans"
                >
                  +91 7666686655
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="shrink-0 text-[#757575]" />
                <a href="mailto:contact@fotocorp.com" className="link-inline-blue font-sans">
                  contact@fotocorp.com
                </a>
              </div>
            </div>
          </div>

          <div>
            <h3 className="fc-display-xs text-black mb-6">Directories</h3>
            <div className="space-y-6">
              {/* Archive Desk */}
              <div className="border-b border-[#e0e0e0] pb-4 space-y-2">
                <span className="fc-body-sans-strong block uppercase tracking-wider text-sm font-bold text-black">
                  Archive Desk
                </span>
                <p className="fc-body-serif-md text-sm text-[#1a1a1a] leading-relaxed">
                  Access expert support for archive research, collection access, metadata services,
                  digitization, and large-scale image delivery.
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
                  Expert guidance on subscription plans, enterprise licensing, and bespoke commercial
                  licensing solutions.
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-[#757575]" />
                  <a href="mailto:subscription@fotocorp.com" className="link-inline-blue font-sans">
                    subscription@fotocorp.com
                  </a>
                </div>
              </div>

              {/* For Contributor */}
              <div className="pb-4 space-y-2">
                <span className="fc-body-sans-strong block uppercase tracking-wider text-sm font-bold text-black">
                  For Contributor
                </span>
                <p className="fc-body-serif-md text-sm text-[#1a1a1a] leading-relaxed">
                  Join our global network of contributors. If you create editorial photography,
                  illustrations, or other visual content.
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-[#757575]" />
                  <a href="mailto:fotodesk@fotocorp.com" className="link-inline-blue font-sans">
                    fotodesk@fotocorp.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
