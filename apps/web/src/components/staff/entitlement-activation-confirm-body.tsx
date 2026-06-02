interface EntitlementActivationLine {
  assetLabel: string
  allowedDownloads: number
  qualityLabel: string
}

interface EntitlementActivationConfirmBodyProps {
  intro: string
  lines: EntitlementActivationLine[]
  emailNote: string
}

export function EntitlementActivationConfirmBody({
  intro,
  lines,
  emailNote,
}: EntitlementActivationConfirmBodyProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{intro}</p>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Asset type
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Downloads
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quality
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.assetLabel} className="border-b border-border last:border-0">
                <td className="px-3 py-3 font-medium text-foreground">{line.assetLabel}</td>
                <td className="px-3 py-3 text-center tabular-nums text-foreground">{line.allowedDownloads}</td>
                <td className="px-3 py-3 text-center text-muted-foreground">{line.qualityLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="rounded-md border border-accent-wash bg-accent-wash/40 px-3 py-2.5 text-sm leading-relaxed text-foreground">
        {emailNote}
      </p>
    </div>
  )
}
