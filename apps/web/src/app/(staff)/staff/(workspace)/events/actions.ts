"use server"

import { revalidatePath } from "next/cache"
import {
  getAdminEventSearchIndexStatus,
  syncAdminEventSearchIndex,
  updateAdminEvent,
  purgeAdminEvent,
} from "@/lib/api/admin-events-api"
import { InternalApiRequestError } from "@/lib/server/internal-api"

export async function updateAdminEventAction(eventId: string, formData: FormData) {
  try {
    const payload = {
      name: formData.get("name")?.toString().trim() || undefined,
      description: formData.get("description")?.toString().trim() || null,
      eventDate: formData.get("eventDate")?.toString() || null,
      location: formData.get("location")?.toString().trim() || null,
      city: formData.get("city")?.toString().trim() || null,
      stateRegion: formData.get("stateRegion")?.toString().trim() || null,
      country: formData.get("country")?.toString().trim() || null,
    }

    if (payload.eventDate) {
      payload.eventDate = new Date(payload.eventDate).toISOString()
    }

    await updateAdminEvent(eventId, payload)
    
    revalidatePath("/staff/events")
    revalidatePath(`/staff/events/${eventId}`)
    
    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Failed to update event" }
  }
}

export async function purgeAdminEventAction(eventId: string, formData: FormData) {
  try {
    const exactName = formData.get("exactName")?.toString() || ""
    const phrase = formData.get("phrase")?.toString() || ""
    const password = formData.get("password")?.toString() || ""

    const data = await purgeAdminEvent(eventId, { exactName, phrase, password })
    
    revalidatePath("/staff/events")
    
    return { success: true, data }
  } catch (error: unknown) {
    return { error: formatStaffEventActionError(error, "Failed to purge event") }
  }
}

export async function syncAdminEventSearchIndexAction(eventId: string) {
  try {
    const result = await syncAdminEventSearchIndex(eventId)
    revalidatePath(`/staff/events/${eventId}`)
    return { success: true, result }
  } catch (error: unknown) {
    return { error: formatStaffEventActionError(error, "Failed to sync public search index") }
  }
}

export async function refreshAdminEventSearchIndexStatusAction(eventId: string) {
  try {
    const status = await getAdminEventSearchIndexStatus(eventId)
    return { success: true, status }
  } catch (error: unknown) {
    return { error: formatStaffEventActionError(error, "Failed to load search index status") }
  }
}

function formatStaffEventActionError(error: unknown, fallback: string) {
  if (error instanceof InternalApiRequestError) {
    const detail = error.detail
    if (typeof detail === "object" && detail && "error" in detail) {
      const message = (detail as { error?: { message?: string } }).error?.message
      if (message) return message
    }
    if (error.message) return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
