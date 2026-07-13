import Link from "next/link"
import { ArrowRight } from "lucide-react"

export const metadata = {
  title: "About — Fotocorp",
  description:
    "Founded in 2004 by award-winning photojournalist Shailesh Mule, Fotocorp is India's premier visual content agency with 1 million+ pan-India editorial images, paparazzi videos, caricatures, and royalty-free stock.",
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
        A million images that tell the story in high resolution.
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
            Founded by award-winning photojournalist Shailesh Mule on World Photography Day in 2004, the
            Mumbai-based agency has an unmatched collection of 1 million+ pan-India editorial images.
            Fotocorp&apos;s visual content represents the entire news spectrum – from Bollywood and Business,
            to Politics, Personalities, Sports, Fashion…and much more.
          </p>

          <div className="border-t border-[#e0e0e0] pt-8">
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              Fotocorp offers current as well as exclusive and rare archive images through subscription and
              licensing. Trusted by leading media organizations worldwide, our images appear across newspapers,
              magazines, broadcast networks, and digital platforms. Today, Fotocorp is counted as India&apos;s
              premier &amp; leading visual content creator with a nationwide network, supplying high-quality
              images to media houses and clients globally.
            </p>
          </div>

          <div className="border-t border-[#e0e0e0] pt-8">
            <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
              Expanding beyond editorial photography, we now offer exclusive paparazzi videos and images,
              creative caricatures, and premium royalty-free stock images, making our platform a comprehensive
              visual content destination. We also take up commissioned editorial, commercial and event
              assignments across India and around the world.
            </p>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8 lg:border-l lg:border-[#e0e0e0] lg:pl-12">
          {/* Section: The Numbers */}
          <div>
            <h3 className="fc-display-xs text-black mb-6">
              Best in Business
            </h3>
            <div className="space-y-6">
              <div className="border-b border-[#e0e0e0] pb-4">
                <span className="fc-display-md block text-black font-normal font-serif">10,00,000+</span>
                <span className="fc-body-sans-sm text-[#757575] mt-1 block">High Resolution Images</span>
              </div>
              <div className="border-b border-[#e0e0e0] pb-4">
                <span className="fc-display-md block text-black font-normal font-serif">22+</span>
                <span className="fc-body-sans-sm text-[#757575] mt-1 block">Years in Business</span>
              </div>
              <div className="border-b border-[#e0e0e0] pb-4">
                <span className="fc-display-md block text-black font-normal font-serif">200+</span>
                <span className="fc-body-sans-sm text-[#757575] mt-1 block">Clients across India &amp; Globally</span>
              </div>
              <div className="border-b border-[#e0e0e0] pb-4">
                <span className="fc-display-md block text-black font-normal font-serif">100%</span>
                <span className="fc-body-sans-sm text-[#757575] mt-1 block">Delivering Excellence</span>
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
          The AAA+ Culture
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border-r border-[#e0e0e0] pr-8 last:border-r-0">
            <h4 className="fc-body-sans-strong text-black font-bold mb-2">Authenticity</h4>
            <p className="fc-body-serif-md text-[#1a1a1a] text-sm leading-relaxed">
              We provide original and unaltered images and videos with metadata, capture details, location
              timestamps, and photographer credits.
            </p>
          </div>
          <div className="border-r border-[#e0e0e0] pr-8 last:border-r-0">
            <h4 className="fc-body-sans-strong text-black font-bold mb-2">Availability</h4>
            <p className="fc-body-serif-md text-[#1a1a1a] text-sm leading-relaxed">
              Subscribers benefit from our comprehensive storage architecture, which delivers exclusive
              availability via optimized and dedicated servers.
            </p>
          </div>
          <div>
            <h4 className="fc-body-sans-strong text-black font-bold mb-2">Accessibility</h4>
            <p className="fc-body-serif-md text-[#1a1a1a] text-sm leading-relaxed">
              Verified subscribers gain access to high-quality originals mapped directly to their account
              parameters. Non-subscribers can browse watermarked thumbnails and request access via our inquiry
              workflows.
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}
