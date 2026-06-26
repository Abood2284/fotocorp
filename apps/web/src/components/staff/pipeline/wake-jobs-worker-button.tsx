"use client"

import { useState } from "react"
import { Loader2, Play } from "lucide-react"

import { wakeJobsPipelineWorker } from "@/lib/api/staff-pipeline-api"
import type { JobsPipelineDrainSummaryHint } from "@/lib/api/staff-pipeline-types"

interface WakeJobsWorkerButtonProps {
  label?: string
  className?: string
  onWakeComplete?: (message: string, ok: boolean, drainSummary?: JobsPipelineDrainSummaryHint) => void
}

export function WakeJobsWorkerButton({
  label = "Process queue now",
  className,
  onWakeComplete,
}: WakeJobsWorkerButtonProps) {
  const [isWaking, setIsWaking] = useState(false)

  async function handleWake() {
    setIsWaking(true)
    try {
      const result = await wakeJobsPipelineWorker()
      onWakeComplete?.(result.message, result.ok, result.drainSummary)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not wake the jobs worker."
      onWakeComplete?.(message, false)
    } finally {
      setIsWaking(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleWake()}
      disabled={isWaking}
      className={
        className
        ?? "inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
      }
    >
      {isWaking ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
      {label}
    </button>
  )
}
