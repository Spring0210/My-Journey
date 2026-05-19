// ─────────────────────────────────────────────────────────
// EmptyMedia — line-art stack of polaroid photos with a sun.
// Used on /media when the user has no uploaded media yet.
// ─────────────────────────────────────────────────────────

export default function EmptyMedia() {
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
      {/* Back polaroid — slightly rotated */}
      <path
        d="M32 38 H80 V92 H32 Z"
        transform="rotate(-8 56 65)"
      />
      <path
        d="M36 46 H76 V78 H36 Z"
        transform="rotate(-8 56 62)"
        opacity="0.6"
      />

      {/* Front polaroid */}
      <path d="M42 32 H92 V94 H42 Z" />
      {/* Photo area */}
      <path d="M48 38 H86 V78 H48 Z" opacity="0.6" />
      {/* Mountains inside the front photo */}
      <path d="M52 74 L62 60 L70 68 L78 56 L86 74" opacity="0.6" />
      {/* Small sun */}
      <circle cx="76" cy="50" r="3.5" opacity="0.6" />
    </svg>
  )
}
