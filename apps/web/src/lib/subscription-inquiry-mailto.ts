export const SUBSCRIPTION_EMAIL = "subscription@fotocorp.com"
export const SUBSCRIPTION_EMAIL_SUBJECT = "Fotocorp subscription inquiry — 22nd anniversary"
export const SUBSCRIPTION_EMAIL_BODY = `Hello Fotocorp Licensing Team,

I'm interested in a Fotocorp subscription starting from ₹5,000 per month. Please recommend the most suitable plan based on the requirements below.

Content needed (Editorial / Royalty Free / Video / Caricature):
Intended use (news, publishing, advertising, social media, etc.):
Estimated downloads per month:
Required image size or quality:
Usage territory (India / worldwide / other):
Preferred start date:

Name:
Company / organisation:
Job title:
Phone:

Please share the available plan options, licensing terms, download limits, and next steps.

Thank you.`

export const SUBSCRIPTION_MAILTO = `mailto:${SUBSCRIPTION_EMAIL}?subject=${encodeURIComponent(
  SUBSCRIPTION_EMAIL_SUBJECT,
)}&body=${encodeURIComponent(SUBSCRIPTION_EMAIL_BODY)}`
