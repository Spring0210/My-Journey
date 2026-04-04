import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { useAuth } from '@/context/AuthContext'
import { getCalendarEntries } from '@/api/journal'
import type { CalendarEvent } from '@/types/api'
import './Calendar.css'

// ─────────────────────────────────────────────────────────
// CalendarPage — FullCalendar 6 month/list view.
// Date click → journal list filtered by date.
// Event click → journal entry detail.
// ─────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { userId } = useAuth()
  const navigate   = useNavigate()
  const [events, setEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    if (!userId) return
    getCalendarEntries(userId)
      .then(data => setEvents(data))
      .catch(() => setEvents([]))
  }, [userId])

  function handleDateClick(info: DateClickArg) {
    // Navigate to journal list with the clicked date pre-filtered
    navigate(`/journal?date=${info.dateStr}`)
  }

  function handleEventClick(info: EventClickArg) {
    info.jsEvent.preventDefault()
    navigate(`/journal/${info.event.id}`)
  }

  return (
    <div className="cal-page">
      <div className="cal-inner">
        <h1 className="cal-title">Calendar</h1>
        <div className="cal-wrap">
          <FullCalendar
            plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left:   'prev,next today',
              center: 'title',
              right:  'dayGridMonth,listWeek',
            }}
            // FullCalendar requires id as string
            events={events.map(e => ({ ...e, id: String(e.id) }))}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            height="auto"
          />
        </div>
      </div>
    </div>
  )
}
