export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return difference === 0
}

export function secretHeaderMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const left = new TextEncoder().encode(provided)
  const right = new TextEncoder().encode(expected)
  return constantTimeEqual(left, right)
}
