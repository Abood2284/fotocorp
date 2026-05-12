import sharp from "sharp"

async function main() {
  const pipeline = sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 10, g: 120, b: 200 }
    }
  }).webp({ quality: 80 })

  const output = await pipeline.toBuffer()

  const result = {
    ok: true as const,
    runtime: "node",
    sharpLoaded: true,
    outputBytes: output.byteLength
  }

  console.log(JSON.stringify(result))
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.log(
    JSON.stringify({
      ok: false,
      runtime: "node",
      sharpLoaded: false,
      error: message
    })
  )
  process.exitCode = 1
})
