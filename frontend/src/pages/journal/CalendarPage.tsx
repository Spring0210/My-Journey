import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventContentArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { getPersonalSpace } from '@/api/spaces'
import { getDocCalendar } from '@/api/documents'
import type { CalendarEvent, SpaceSummaryResponse } from '@/types/api'
import PageTopBar from '@/components/ui/PageTopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import Icon from '@/components/ui/Icon'
import YearHeatmap from './YearHeatmap'
import './Calendar.css'

// ─────────────────────────────────────────────────────────
// CalendarPage — month / list / year-heatmap views.
// Date click → journal list filtered by date.
// Event click → journal entry detail.
// Event pills show a small camera glyph when the entry has photos.
// ─────────────────────────────────────────────────────────

type CalView = 'month' | 'list' | 'year'

export default function CalendarPage() {
  const navigate = useNavigate()
  const [personalSpace, setPersonalSpace] = useState<SpaceSummaryResponse | null>(null)
  const [events, setEvents]   = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView]       = useState<CalView>('month')

  useEffect(() => {
    setLoading(true)
    getPersonalSpace()
      .then(space => {
        setPersonalSpace(space)
        return getDocCalendar(space.id)
      })
      .then(data => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  function handleDateClick(info: DateClickArg) {
    // Navigate to journal list with the clicked date pre-filtered
    navigate(`/journal?date=${info.dateStr}`)
  }

  function handleEventClick(info: EventClickArg) {
    info.jsEvent.preventDefault()
    if (!personalSpace) return
    navigate(`/spaces/${personalSpace.id}/documents/${info.event.id}`)
  }

  // Custom event pill — show a camera glyph when the entry has photos
  function renderEventContent(arg: EventContentArg) {
    const hasImage = (arg.event.extendedProps as { hasImage?: boolean }).hasImage
    return (
      <div className="cal-event-pill">
        {hasImage && (
          <span className="cal-event-icon" aria-hidden="true">
            <Icon name="image" size={10} strokeWidth={2} />
          </span>
        )}
        <span className="cal-event-title">{arg.event.title}</span>
      </div>
    )
  }

  return (
    <div className="cal-page">

      <PageTopBar title="Calendar" />

      <div className="cal-inner">
        {/* View toggle — month / list / year heatmap.
            Custom toggle (not FullCalendar's built-in) because year heatmap
            isn't a FullCalendar view. */}
        <div className="cal-view-toggle" role="tablist" aria-label="Calendar view">
          {(['month', 'list', 'year'] as CalView[]).map(v => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={`cal-view-btn${view === v ? ' cal-view-btn--active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'month' ? 'Month' : v === 'list' ? 'List' : 'Year'}
            </button>
          ))}
        </div>

        <div className="cal-wrap">
          {loading ? (
            <CalendarSkeleton />
          ) : view === 'year' ? (
            <YearHeatmap />
          ) : (
            <FullCalendar
              key={view}
              plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
              initialView={view === 'month' ? 'dayGridMonth' : 'listWeek'}
              headerToolbar={{
                left:   'prev,next today',
                center: 'title',
                right:  '',
              }}
              // FullCalendar requires id as string; pass hasImage through extendedProps
              events={events.map(e => ({
                id: String(e.id),
                title: e.title,
                start: e.start,
                extendedProps: { hasImage: e.hasImage },
              }))}
              eventContent={renderEventContent}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              height="auto"
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// CalendarSkeleton — toolbar + 5x7 grid of empty day cells.
// ─────────────────────────────────────────────────────────
function CalendarSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton width={32} height={28} radius={8} />
          <Skeleton width={32} height={28} radius={8} />
          <Skeleton width={56} height={28} radius={8} />
        </div>
        <Skeleton width={140} height={20} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton width={64} height={28} radius={8} />
          <Skeleton width={64} height={28} radius={8} />
        </div>
      </div>

      {/* Day header row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} height={12} radius={4} />
        ))}
      </div>

      {/* 5x7 grid of day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} height={80} radius={6} />
        ))}
      </div>
    </div>
  )
}
