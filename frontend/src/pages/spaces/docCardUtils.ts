// ─────────────────────────────────────────────────────────
// Shared helpers for doc list cards.
// Used by SpaceDetailPage's DocCard and the /journal list.
// ─────────────────────────────────────────────────────────

// Format ISO timestamp to a human-readable relative string.
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

// Format a JOURNAL entry date ("YYYY-MM-DD"). Drops the year for dates in
// the current year, matching the way other apps surface diary dates.
export function formatEntryDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' })
}

// Crude markdown → plain text for list snippets. We're not trying to render,
// just to keep "#" / "**" / "- " noise out of the card preview.
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')        // images
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')     // links → text
    .replace(/^#{1,6}\s+/gm, '')                 // headings
    .replace(/^>\s+/gm, '')                      // blockquote
    .replace(/^[-*+]\s+/gm, '')                  // unordered list bullets
    .replace(/^\d+\.\s+/gm, '')                  // ordered list markers
    .replace(/```[\s\S]*?```/g, '')              // fenced code blocks
    .replace(/`([^`]+)`/g, '$1')                 // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1')           // **bold**
    .replace(/__([^_]+)__/g, '$1')               // __bold__
    .replace(/\*([^*]+)\*/g, '$1')               // *italic*
    .replace(/_([^_]+)_/g, '$1')                 // _italic_
    .replace(/~~([^~]+)~~/g, '$1')               // ~~strike~~
    .replace(/\s+/g, ' ')                        // collapse whitespace
    .trim()
}
