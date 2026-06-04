import { main } from "./publishWakeServer"

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ event: "publish_wake_failed", error: message }))
  console.error(error)
  process.exitCode = 1
})
