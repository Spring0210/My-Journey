import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPersonalSpace } from '@/api/spaces'
import { getDocHeatmap } from '@/api/documents'
import type { HeatmapPoint } from '@/types/api'
import { Skeleton } from '@/components/ui/Skeleton'
import Icon from '@/components/ui/Icon'
import './YearHeatmap.css'

// ─────────────────────────────────────────────────────────
// YearHeatmap — GitHub-style 53x7 contribution grid.
// One cell per day of the year, color depth scaled to entry count.
// Click a cell to jump to the journal list filtered by that date.
// ─────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const MONTH_LABELS   = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
]

// Convert a Date → ISO "YYYY-MM-DD" without timezone drift
function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Bucket the count into a 0..4 intensity level for the color scale
function intensity(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  return 4
}

export default function YearHeatmap() {
  const navigate = useNavigate()

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [points, setPoints] = useState<HeatmapPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [personalSpaceId, setPersonalSpaceId] = useState<number | null>(null)

  // Resolve personal space once; reuse for subsequent year switches.
  useEffect(() => {
    getPersonalSpace()
      .then(s => setPersonalSpaceId(s.id))
      .catch(() => setPersonalSpaceId(null))
  }, [])

  useEffect(() => {
    if (personalSpaceId == null) return
    setLoading(true)
    getDocHeatmap(personalSpaceId, year)
      .then(setPoints)
      .catch(() => setPoints([]))
      .finally(() => setLoading(false))
  }, [personalSpaceId, year])

  // Index point counts by ISO date for O(1) lookup during render
  const countByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of points) m.set(p.date, p.count)
    return m
  }, [points])

  // Compute the grid: 53 columns × 7 rows, starting on Sunday of Jan-1 week
  const grid = useMemo(() => {
    const yearStart = new Date(year, 0, 1)
    const yearEnd   = new Date(year, 11, 31)
    // Roll back to the Sunday of the week containing Jan 1
    const gridStart = new Date(yearStart)
    gridStart.setDate(yearStart.getDate() - yearStart.getDay())

    const cols: { date: Date; inYear: boolean; iso: string; count: number }[][] = []
    const cursor = new Date(gridStart)
    for (let col = 0; col < 53; col++) {
      const week: typeof cols[number] = []
      for (let row = 0; row < 7; row++) {
        const inYear = cursor >= yearStart && cursor <= yearEnd
        const iso = isoDate(cursor)
        week.push({
          date: new Date(cursor),
          inYear,
          iso,
          count: inYear ? (countByDate.get(iso) ?? 0) : 0,
        })
        cursor.setDate(cursor.getDate() + 1)
      }
      cols.push(week)
    }
    return cols
  }, [year, countByDate])

  // Compute month labels: position label at the first column where each month starts
  const monthPositions = useMemo(() => {
    const positions: { month: number; col: number }[] = []
    let prevMonth = -1
    grid.forEach((week, col) => {
      // Use the first in-year cell of this week to determine month
      const firstInYear = week.find(d => d.inYear)
      if (!firstInYear) return
      const m = firstInYear.date.getMonth()
      if (m !== prevMonth) {
        positions.push({ month: m, col })
        prevMonth = m
      }
    })
    return positions
  }, [grid])

  // Total entry count for the year (header summary)
  const totalEntries = useMemo(
    () => points.reduce((sum, p) => sum + p.count, 0),
    [points],
  )

  return (
    <div className="heatmap">
      {/* Header: title + year navigator */}
      <div className="heatmap-header">
        <div className="heatmap-title-row">
          <h3 className="heatmap-title">
            {loading ? '...' : totalEntries} entries in {year}
          </h3>
        </div>
        <div className="heatmap-year-nav">
          <button
            className="heatmap-year-btn"
            onClick={() => setYear(y => y - 1)}
            aria-label="Previous year"
          >
            <Icon name="chevron-left" size={16} />
          </button>
          <span className="heatmap-year-label">{year}</span>
          <button
            className="heatmap-year-btn"
            onClick={() => setYear(y => y + 1)}
            disabled={year >= currentYear}
            aria-label="Next year"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <Skeleton width="100%" height={160} radius={8} />
      ) : (
        <>
          <div className="heatmap-scroll">
            <div className="heatmap-grid-wrap">
              {/* Month labels — absolutely positioned above their starting column */}
              <div className="heatmap-month-row">
                {monthPositions.map(({ month, col }) => (
                  <span
                    key={month}
                    className="heatmap-month-label"
                    style={{ left: `${col * 14}px` }}
                  >
                    {MONTH_LABELS[month]}
                  </span>
                ))}
              </div>

              <div className="heatmap-body">
                {/* Weekday labels — left rail */}
                <div className="heatmap-weekday-col">
                  {WEEKDAY_LABELS.map((label, i) => (
                    <span key={i} className="heatmap-weekday-label">{label}</span>
                  ))}
                </div>

                {/* Grid columns */}
                <div className="heatmap-grid">
                  {grid.map((week, col) => (
                    <div key={col} className="heatmap-col">
                      {week.map((cell, row) => (
                        <button
                          key={`${col}-${row}`}
                          className={`heatmap-cell heatmap-cell--level-${intensity(cell.count)}`}
                          style={{ visibility: cell.inYear ? 'visible' : 'hidden' }}
                          onClick={() => {
                            if (cell.inYear) navigate(`/journal?date=${cell.iso}`)
                          }}
                          title={cell.inYear
                            ? `${cell.iso} · ${cell.count} ${cell.count === 1 ? 'entry' : 'entries'}`
                            : ''
                          }
                          aria-label={cell.inYear ? `${cell.iso}, ${cell.count} entries` : ''}
                          tabIndex={cell.inYear ? 0 : -1}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="heatmap-legend">
            <span className="heatmap-legend-label">Less</span>
            <span className="heatmap-cell heatmap-cell--level-0" />
            <span className="heatmap-cell heatmap-cell--level-1" />
            <span className="heatmap-cell heatmap-cell--level-2" />
            <span className="heatmap-cell heatmap-cell--level-3" />
            <span className="heatmap-cell heatmap-cell--level-4" />
            <span className="heatmap-legend-label">More</span>
          </div>
        </>
      )}
    </div>
  )
}
