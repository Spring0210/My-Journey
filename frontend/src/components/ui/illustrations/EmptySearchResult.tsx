// ─────────────────────────────────────────────────────────
// EmptySearchResult — magnifier + question mark.
// Used on JournalList when a search returns zero entries.
// ─────────────────────────────────────────────────────────

export default function EmptySearchResult() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      stroke="var(--label-tertiary)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Magnifier glass */}
      <circle cx="52" cy="52" r="26" />
      {/* Magnifier handle */}
      <path d="M71 71 L92 92" />
      {/* Question mark inside the glass */}
      <path d="M46 44 A6 6 0 0 1 58 44 C58 50 52 50 52 56" />
      <circle cx="52" cy="62" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}
