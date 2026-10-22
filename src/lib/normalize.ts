/** Loose answer matching: case, accents, punctuation and extra spaces are ignored. Mirrors private.normalize_answer() in SQL. */
export function normalizeAnswer(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function answerMatches(answer: string, accepted: string[]): boolean {
  const a = normalizeAnswer(answer)
  if (!a) return false
  if (accepted.length === 0) return true
  return accepted.some((x) => normalizeAnswer(x) === a)
}
