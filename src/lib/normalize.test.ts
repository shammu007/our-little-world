import { describe, expect, it } from 'vitest'
import { answerMatches, normalizeAnswer } from './normalize'

describe('normalizeAnswer', () => {
  it('ignores case, accents, punctuation and spacing', () => {
    expect(normalizeAnswer('  Crème   Brûlée!! ')).toBe('creme brulee')
    expect(normalizeAnswer('twenty-five')).toBe('twenty five')
  })
  it('matches accepted answers loosely', () => {
    expect(answerMatches('PIANO.', ['piano'])).toBe(true)
    expect(answerMatches('guitar', ['piano'])).toBe(false)
    expect(answerMatches('anything', [])).toBe(true)
    expect(answerMatches('   ', [])).toBe(false)
  })
})
