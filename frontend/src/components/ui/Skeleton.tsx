import './Skeleton.css'
import type { CSSProperties } from 'react'

// ─────────────────────────────────────────────────────────
// Skeleton — placeholder block with shimmer animation.
// Use as a building primitive to assemble page-shaped
// skeleton layouts.  Honors prefers-reduced-motion.
// ─────────────────────────────────────────────────────────

interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: number | string
  className?: string
  style?: CSSProperties
}

export function Skeleton({
  width = '100%', height = 16, radius = 6, className = '', style,
}: SkeletonProps) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{
        width:        typeof width === 'number' ? `${width}px` : width,
        height:       typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

// Round avatar / dot placeholder
export function SkeletonCircle({ size, className = '', style }: { size: number; className?: string; style?: CSSProperties }) {
  return (
    <Skeleton
      width={size}
      height={size}
      radius="50%"
      className={className}
      style={style}
    />
  )
}

// Multi-line text block — each line is slightly different width for natural feel
export function SkeletonText({
  lines = 3, lineHeight = 14, gap = 8, lastLineWidth = '60%',
}: {
  lines?: number
  lineHeight?: number
  gap?: number
  lastLineWidth?: string
}) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </span>
  )
}
