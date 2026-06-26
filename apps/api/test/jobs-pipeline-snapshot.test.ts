import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildJobsDrainWebhookUrl,
  formatStaffDrainWakeMessage,
} from "../src/lib/jobs/publish-drain-webhook"
import { resolveJobsHealthUrl } from "../src/lib/jobs/jobs-pipeline-snapshot"

describe("buildJobsDrainWebhookUrl", () => {
  it("appends wait=1 for staff wake", () => {
    assert.equal(
      buildJobsDrainWebhookUrl("https://jobs-internal.example.com/internal/publish/drain", {
        waitForCompletion: true,
      }),
      "https://jobs-internal.example.com/internal/publish/drain?wait=1",
    )
  })
})

describe("resolveJobsHealthUrl", () => {
  it("derives /health from drain webhook URL", () => {
    assert.equal(
      resolveJobsHealthUrl("https://jobs-internal.example.com/internal/publish/drain"),
      "https://jobs-internal.example.com/health",
    )
  })
})

describe("formatStaffDrainWakeMessage", () => {
  it("explains processing_disabled", () => {
    const result = formatStaffDrainWakeMessage({
      pendingAtStart: 2,
      pendingAtEnd: 2,
      processed: 0,
      stopReason: "processing_disabled",
      durationMs: 12,
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, "processing_disabled")
    assert.match(result.message, /IMAGE_PUBLISH_PROCESSING_ENABLED=true/)
  })

  it("reports successful processing", () => {
    const result = formatStaffDrainWakeMessage({
      pendingAtStart: 2,
      pendingAtEnd: 0,
      processed: 2,
      stopReason: "empty",
      durationMs: 4000,
    })
    assert.equal(result.ok, true)
    assert.match(result.message, /Processed 2 job/)
  })
})
