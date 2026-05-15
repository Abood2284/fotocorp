"use server"

import { revalidatePath } from "next/cache"
import { updateAdminEvent, purgeAdminEvent } from "@/lib/api/admin-events-api"

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
  } catch (error: any) {
    return { error: error.message || "Failed to purge event" }
  }
}
