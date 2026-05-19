// ─────────────────────────────────────────────────────────
// EmptyNotifications — bell + check.
// Used on NotificationsPage when the inbox is empty.
// ─────────────────────────────────────────────────────────

export default function EmptyNotifications() {
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
      {/* Bell body */}
      <path d="M40 78 C40 60 44 50 52 46 L52 40 A8 8 0 0 1 68 40 L68 46 C76 50 80 60 80 78 L84 82 L36 82 Z" />
      {/* Bell clapper */}
      <path d="M55 90 A5 5 0 0 0 65 90" />
      {/* Check mark badge — circle bottom-right */}
      <circle cx="88" cy="84" r="12" fill="var(--surface-card)" />
      <circle cx="88" cy="84" r="12" />
      <path d="M82 84 L86 88 L94 80" />
    </svg>
  )
}
