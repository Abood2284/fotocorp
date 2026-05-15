import {
  isEntitlementQualitySufficientForSize,
  type SubscriberDownloadSize,
} from "../../src/lib/subscriber-download-quality"

function assertEqual(name: string, actual: boolean, expected: boolean) {
  if (actual !== expected) {
    console.error(`FAIL: ${name} — expected ${expected}, got ${actual}`)
    process.exit(1)
  }
}

const cases: Array<{
  entitlement: string
  size: SubscriberDownloadSize
  expected: boolean
  label: string
}> = [
  { entitlement: "LOW", size: "web", expected: true, label: "LOW + WEB = allowed" },
  { entitlement: "LOW", size: "medium", expected: false, label: "LOW + MEDIUM = blocked" },
  { entitlement: "MEDIUM", size: "web", expected: true, label: "MEDIUM + WEB = allowed" },
  { entitlement: "MEDIUM", size: "medium", expected: true, label: "MEDIUM + MEDIUM = allowed" },
  { entitlement: "MEDIUM", size: "large", expected: false, label: "MEDIUM + LARGE = blocked" },
  { entitlement: "HIGH", size: "large", expected: true, label: "HIGH + LARGE = allowed" },
]

for (const c of cases) {
  assertEqual(
    c.label,
    isEntitlementQualitySufficientForSize(c.entitlement, c.size),
    c.expected
  )
}

console.log("subscriber_download_quality_smoke_ok", { cases: cases.length })
