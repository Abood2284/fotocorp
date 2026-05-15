import { notFound } from "next/navigation"
import { getStaffAccessInquiryDetail, StaffApiError } from "@/lib/api/staff-api"
import { StaffAccessInquiryDetail } from "@/components/staff/staff-access-inquiry-detail"
import { getStaffCookieHeader } from "@/lib/staff-session"

export const metadata = {
  title: "Access inquiry — Fotocorp",
}

interface PageProps {
  params: Promise<{ inquiryId: string }>
}

export default async function StaffAccessInquiryDetailPage({ params }: PageProps) {
  const { inquiryId } = await params
  let detail: Awaited<ReturnType<typeof getStaffAccessInquiryDetail>>
  try {
    detail = await getStaffAccessInquiryDetail(inquiryId, { cookieHeader: await getStaffCookieHeader() })
  } catch (caught) {
    if (caught instanceof StaffApiError && caught.status === 404) notFound()
    throw caught
  }
  if (!detail?.ok) notFound()

  return <StaffAccessInquiryDetail inquiryId={inquiryId} initial={detail} />
}
