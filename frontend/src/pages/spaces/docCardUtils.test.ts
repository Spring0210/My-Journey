import { describe, it, expect } from 'vitest'
import { stripMarkdown, formatEntryDate, formatRelativeTime } from './docCardUtils'

// Smoke test for the new vitest harness, exercising real production helpers
// so we know the FE test pipeline (vitest + tsc resolve + jsdom) is actually
// wired correctly. Not aiming for exhaustive coverage of these utilities.

describe('stripMarkdown', () => {
  it('removes inline code, bold/italic markers, and headings', () => {
    const input = '# Heading\nThis is **bold** and *italic* and `code`.'
    expect(stripMarkdown(input)).toBe('Heading This is bold and italic and code.')
  })

  it('drops images entirely but preserves link text', () => {
    const input = 'See ![alt](https://example.com/x.png) and [docs](https://example.com).'
    expect(stripMarkdown(input)).toBe('See and docs.')
  })

  it('collapses whitespace', () => {
    expect(stripMarkdown('a   b\n\n\nc')).toBe('a b c')
  })
})

describe('formatEntryDate', () => {
  it('emits Mon Day for dates in the current year', () => {
    const thisYear = new Date().getFullYear()
    const out = formatEntryDate(`${thisYear}-03-15`)
    expect(out).toMatch(/Mar 15/)
    expect(out).not.toMatch(String(thisYear))
  })

  it('includes the year for dates in other years', () => {
    const out = formatEntryDate('2020-12-31')
    expect(out).toMatch(/2020/)
  })
})

describe('formatRelativeTime', () => {
  it('returns "Just now" for very recent timestamps', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('Just now')
  })

  it('returns minute-granular for under-1-hour timestamps', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago')
  })

  it('returns hour-granular for under-24h timestamps', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago')
  })
})
