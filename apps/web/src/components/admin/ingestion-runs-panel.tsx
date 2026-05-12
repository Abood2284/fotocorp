"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import type { IngestionRun } from "@/lib/fixtures/admin"
import { RunStatusChip } from "@/components/admin/status-chip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface IngestionRunsPanelProps {
  runs: IngestionRun[]
}

export function IngestionRunsPanel({ runs }: IngestionRunsPanelProps) {
  const [selectedRunId, setSelectedRunId] = useState(runs[0]?.id ?? "")
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0]
  if (!selectedRun) return null

  const totalSuccess = runs.reduce((sum, run) => sum + run.successCount, 0)
  const totalFailure = runs.reduce((sum, run) => sum + run.failureCount, 0)
  const totalPending = runs.reduce((sum, run) => sum + run.pendingCount, 0)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalSuccess}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failure</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{totalFailure}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{totalPending}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingestion run list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${run.id === selectedRun.id ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{run.id}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{run.source}</p>
                  </div>
                  <RunStatusChip status={run.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>success: {run.successCount}</span>
                  <span>failure: {run.failureCount}</span>
                  <span>pending: {run.pendingCount}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Run detail</CardTitle>
            <RunStatusChip status={selectedRun.status} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Run:</span> {selectedRun.id}</p>
            <p><span className="text-muted-foreground">Started:</span> {selectedRun.startedAt}</p>
            <p><span className="text-muted-foreground">Ended:</span> {selectedRun.endedAt ?? "In progress"}</p>
            <p><span className="text-muted-foreground">Source:</span> {selectedRun.source}</p>

            <div className="pt-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Error list</p>
              {selectedRun.errors.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {selectedRun.errors.map((error) => (
                    <div key={error.id} className="rounded-md border border-red-200 bg-red-50 p-2.5">
                      <div className="flex items-center gap-1 text-xs font-medium text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {error.assetId} · {error.stage}
                      </div>
                      <p className="mt-1 text-xs text-red-800">{error.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No errors in this run.</p>
              )}
            </div>

            <div className="pt-2">
              <Button variant="secondary" className="w-full">Trigger re-run (mock)</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
