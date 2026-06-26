"use client"

import type { JobsPipelineSnapshot, JobsPipelineWakeResult } from "@/lib/api/staff-pipeline-types"

export async function fetchJobsPipelineSnapshot(): Promise<JobsPipelineSnapshot> {
  const response = await fetch("/api/staff/pipeline/snapshot", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })

  const data = (await response.json().catch(() => ({}))) as JobsPipelineSnapshot & {
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Could not load pipeline snapshot.")
  }

  return data
}

export async function wakeJobsPipelineWorker(): Promise<JobsPipelineWakeResult> {
  const response = await fetch("/api/staff/pipeline/wake", {
    method: "POST",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })

  const data = (await response.json().catch(() => ({}))) as JobsPipelineWakeResult & {
    error?: { message?: string }
  }

  if (!response.ok && !data.status) {
    throw new Error(data.error?.message ?? "Could not wake the jobs worker.")
  }

  return data
}
