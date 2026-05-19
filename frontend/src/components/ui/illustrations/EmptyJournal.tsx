// ─────────────────────────────────────────────────────────
// EmptyJournal — line-art illustration of a feather + page.
// Used on Dashboard and JournalList when no entries exist.
// ─────────────────────────────────────────────────────────

export default function EmptyJournal() {
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
      {/* Page outline */}
      <path d="M30 22 H70 L86 38 V96 A4 4 0 0 1 82 100 H30 A4 4 0 0 1 26 96 V26 A4 4 0 0 1 30 22 Z" />
      {/* Folded corner */}
      <path d="M70 22 V38 H86" />
      {/* Ruled lines (soft) */}
      <path d="M36 52 H62" opacity="0.5" />
      <path d="M36 62 H76" opacity="0.5" />
      <path d="M36 72 H70" opacity="0.5" />
      {/* Feather quill stroke */}
      <path d="M58 30 L94 66" />
      {/* Feather barbs */}
      <path d="M64 36 L70 30" />
      <path d="M70 42 L78 34" />
      <path d="M76 48 L86 40" />
      <path d="M82 54 L92 46" />
      {/* Quill tip */}
      <path d="M92 64 L98 70" />
    </svg>
  )
}
