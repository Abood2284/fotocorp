// apps/web/src/components/marketing/contact-form.tsx
"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"

export function ContactForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || !subject || !message) {
      setError("Please fill out all fields.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Simulate API submit
      await new Promise((resolve) => setTimeout(resolve, 1200))
      setSubmitted(true)
    } catch (err) {
      setError("An error occurred. Please try again later.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4 p-8 bg-[#f5f5f5] border border-[#e0e0e0] text-black">
        <h3 className="fc-display-sm font-normal">Thank you.</h3>
        <p className="fc-body-serif-md text-[#1a1a1a] leading-relaxed">
          Your inquiry has been received by our desk. A representative from the appropriate department will respond within 24 hours.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false)
            setName("")
            setEmail("")
            setSubject("")
            setMessage("")
          }}
          className="button-outline-square text-xs px-4 py-2 mt-2 uppercase tracking-wider"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-sans">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="contact-name" className="fc-body-sans-strong text-sm uppercase tracking-wider font-bold block">
            Full Name
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            className="w-full bg-white text-black border border-black focus:border-[#757575] focus:outline-none px-4 py-3 font-sans rounded-none text-base transition-colors"
            placeholder="John Doe"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-email" className="fc-body-sans-strong text-sm uppercase tracking-wider font-bold block">
            Business Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="w-full bg-white text-black border border-black focus:border-[#757575] focus:outline-none px-4 py-3 font-sans rounded-none text-base transition-colors"
            placeholder="email@company.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="contact-subject" className="fc-body-sans-strong text-sm uppercase tracking-wider font-bold block">
          Subject
        </label>
        <input
          id="contact-subject"
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={submitting}
          className="w-full bg-white text-black border border-black focus:border-[#757575] focus:outline-none px-4 py-3 font-sans rounded-none text-base transition-colors"
          placeholder="Archive Licensing / Technical Support"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="contact-message" className="fc-body-sans-strong text-sm uppercase tracking-wider font-bold block">
          Message
        </label>
        <textarea
          id="contact-message"
          rows={6}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={submitting}
          className="w-full bg-white text-black border border-black focus:border-[#757575] focus:outline-none px-4 py-3 font-sans rounded-none text-base transition-colors resize-y"
          placeholder="Please describe your inquiry in detail..."
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="button-primary-square inline-flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 disabled:opacity-50"
      >
        {submitting ? "Sending..." : "Submit Inquiry"}
        {!submitting && <ArrowRight size={16} />}
      </button>
    </form>
  )
}
