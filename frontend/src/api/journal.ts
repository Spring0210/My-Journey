// ─────────────────────────────────────────────────────────
// Journal API — typed wrappers for all /api/entries/**
// endpoints. All calls go through apiRequest / apiRequestWithFile.
// ─────────────────────────────────────────────────────────

import { apiRequest, apiRequestWithFile } from './client'
import type { JournalEntry, PageResponse, CalendarEvent, HeatmapPoint } from '@/types/api'

// GET /api/entries/:userId?page=&size=
export function getEntries(
  userId: number,
  page = 0,
  size = 9,
): Promise<PageResponse<JournalEntry>> {
  return apiRequest(`/entries/${userId}?page=${page}&size=${size}`)
}

// GET /api/entries/entry/:entryId
export function getEntry(entryId: number): Promise<JournalEntry> {
  return apiRequest(`/entries/entry/${entryId}`)
}

// POST /api/entries/:userId  (multipart)
export function createEntry(
  userId: number,
  title: string,
  content: string,
  entryDate: string,
  images: File[],
): Promise<JournalEntry> {
  const fd = new FormData()
  fd.append('title', title)
  fd.append('content', content)
  fd.append('entryDate', entryDate)
  images.forEach(f => fd.append('images', f))
  return apiRequestWithFile(`/entries/${userId}`, fd)
}

// POST /api/entries/edit/:entryId  (multipart — appends new images)
export function editEntry(
  entryId: number,
  title: string,
  content: string,
  entryDate: string,
  images: File[],
): Promise<JournalEntry> {
  const fd = new FormData()
  fd.append('title', title)
  fd.append('content', content)
  fd.append('entryDate', entryDate)
  images.forEach(f => fd.append('images', f))
  return apiRequestWithFile(`/entries/edit/${entryId}`, fd)
}

// DELETE /api/entries/:entryId
export function deleteEntry(entryId: number): Promise<void> {
  return apiRequest(`/entries/${entryId}`, { method: 'DELETE' })
}

// POST /api/entries/delete-image
export function deleteImage(entryId: number, imagePath: string): Promise<void> {
  return apiRequest('/entries/delete-image', {
    method: 'POST',
    body: JSON.stringify({ entryId, imagePath }),
  })
}

// GET /api/entries/search?userId=&keyword=&date=
export function searchEntries(
  userId: number,
  keyword?: string,
  date?: string,
): Promise<JournalEntry[]> {
  const params = new URLSearchParams({ userId: String(userId) })
  if (keyword) params.set('keyword', keyword)
  if (date) params.set('date', date)
  return apiRequest(`/entries/search?${params}`)
}

// GET /api/entries/calendar/:userId
export function getCalendarEntries(userId: number): Promise<CalendarEvent[]> {
  return apiRequest(`/entries/calendar/${userId}`)
}

// GET /api/entries/heatmap?userId=&year=
// Returns one HeatmapPoint per day that has at least one entry.
export function getHeatmap(userId: number, year: number): Promise<HeatmapPoint[]> {
  return apiRequest(`/entries/heatmap?userId=${userId}&year=${year}`)
}

// POST /api/entries/ai-search
export function aiSearch(
  query: string,
): Promise<{ keywords: string[]; entries: JournalEntry[] }> {
  return apiRequest('/entries/ai-search', {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}

// POST /api/entries/ai-recap
export function aiRecap(
  year: number,
  month: number,
): Promise<{ recap?: string; error?: string }> {
  return apiRequest('/entries/ai-recap', {
    method: 'POST',
    body: JSON.stringify({ year, month }),
  })
}

// POST /api/entries/ai-prompts
export function aiPrompts(): Promise<{ prompts?: string[]; error?: string }> {
  return apiRequest('/entries/ai-prompts', { method: 'POST' })
}
