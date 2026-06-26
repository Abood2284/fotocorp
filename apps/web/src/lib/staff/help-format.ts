export function formatHelpDifficulty(value: string | null | undefined) {
  if (!value) return null
  switch (value) {
    case "BEGINNER":
      return "Beginner"
    case "INTERMEDIATE":
      return "Intermediate"
    case "ADVANCED":
      return "Advanced"
    default:
      return value
  }
}

export function formatHelpDuration(minutes: number | null | undefined) {
  if (!minutes || minutes < 1) return null
  return minutes === 1 ? "1 min" : `${minutes} min`
}

export function formatHelpDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatHelpMetaLine(input: {
  difficulty?: string | null
  estimatedMinutes?: number | null
  updatedAt?: string | null
  publishedAt?: string | null
}) {
  const parts: string[] = []
  const difficulty = formatHelpDifficulty(input.difficulty)
  if (difficulty) parts.push(difficulty)
  const duration = formatHelpDuration(input.estimatedMinutes)
  if (duration) parts.push(duration)
  const date = formatHelpDate(input.updatedAt ?? input.publishedAt)
  if (date) parts.push(`Updated ${date}`)
  return parts.join(" · ")
}
