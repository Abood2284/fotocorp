"use server"

import { revalidatePath } from "next/cache"
import {
  getHomepageHeroPool,
  listHomepageHeroPoolCandidates,
  replaceHomepageHeroPool,
} from "@/lib/api/admin-homepage-hero-api"

export async function fetchHomepageHeroPoolAction() {
  return getHomepageHeroPool()
}

export async function searchHomepageHeroCandidatesAction(input: {
  q?: string
  cursor?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (input.q?.trim()) params.set("q", input.q.trim())
  if (input.cursor?.trim()) params.set("cursor", input.cursor.trim())
  if (input.limit) params.set("limit", String(input.limit))
  return listHomepageHeroPoolCandidates(params)
}

export async function saveHomepageHeroPoolAction(assetIds: string[]) {
  const result = await replaceHomepageHeroPool(assetIds)
  revalidatePath("/staff/homepage-hero")
  return result
}
