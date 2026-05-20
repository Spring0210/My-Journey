// ─────────────────────────────────────────────────────────
// Documents API — typed wrappers for /api/spaces/{id}/documents
// and /api/documents/{id}** endpoints.
// PR 1 surfaces read + comment + delete only.
// Create / update / attachment upload land in PR 2-3.
// ─────────────────────────────────────────────────────────

import { apiRequest, apiUploadWithProgress } from './client'
import type {
  DocumentResponse,
  DocumentSummaryResponse,
  DocumentCommentResponse,
  DocumentAttachmentResponse,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  PageResponse,
  CalendarEvent,
  HeatmapPoint,
  DocType,
} from '@/types/api'

// ── Documents: list & read ────────────────────────────────

// Paginated list of documents in a space.
// type:  JOURNAL|NOTE  — optional doc-type filter
// date:  YYYY-MM-DD    — optional entry_date match (powers calendar/heatmap drill-in)
export function listDocuments(
  spaceId: number,
  opts: { type?: DocType; date?: string; page?: number; size?: number } = {},
): Promise<PageResponse<DocumentSummaryResponse>> {
  const params = new URLSearchParams()
  if (opts.type) params.set('type', opts.type)
  if (opts.date) params.set('date', opts.date)
  params.set('page', String(opts.page ?? 0))
  params.set('size', String(opts.size ?? 20))
  return apiRequest(`/spaces/${spaceId}/documents?${params.toString()}`)
}

// Calendar feed for /journal — one event per JOURNAL doc with an entry_date.
export function getDocCalendar(spaceId: number): Promise<CalendarEvent[]> {
  return apiRequest(`/spaces/${spaceId}/documents/calendar`)
}

// Year heatmap for /journal — count of JOURNAL docs per day in the given year.
export function getDocHeatmap(spaceId: number, year: number): Promise<HeatmapPoint[]> {
  return apiRequest(`/spaces/${spaceId}/documents/heatmap?year=${year}`)
}

export function getDocument(docId: number): Promise<DocumentResponse> {
  return apiRequest(`/documents/${docId}`)
}

// ── Documents: write (declared now, used from PR 2 onward) ─

export function createDocument(
  spaceId: number,
  req: CreateDocumentRequest,
): Promise<DocumentResponse> {
  return apiRequest(`/spaces/${spaceId}/documents`, {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export function updateDocument(
  docId: number,
  req: UpdateDocumentRequest,
): Promise<DocumentResponse> {
  return apiRequest(`/documents/${docId}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  })
}

export function deleteDocument(docId: number): Promise<void> {
  return apiRequest(`/documents/${docId}`, { method: 'DELETE' })
}

// ── Comments ──────────────────────────────────────────────

export function listDocumentComments(docId: number): Promise<DocumentCommentResponse[]> {
  return apiRequest(`/documents/${docId}/comments`)
}

export function addDocumentComment(
  docId: number,
  content: string,
): Promise<DocumentCommentResponse> {
  return apiRequest(`/documents/${docId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function deleteDocumentComment(
  docId: number,
  commentId: number,
): Promise<void> {
  return apiRequest(`/documents/${docId}/comments/${commentId}`, {
    method: 'DELETE',
  })
}

// ── Attachments ───────────────────────────────────────────

export function listDocumentAttachments(docId: number): Promise<DocumentAttachmentResponse[]> {
  return apiRequest(`/documents/${docId}/attachments`)
}

// Upload one file via multipart. onProgress fires with 0-100 pct values.
export function uploadAttachment(
  docId: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<DocumentAttachmentResponse> {
  const fd = new FormData()
  fd.append('file', file)
  return apiUploadWithProgress(
    `/documents/${docId}/attachments`,
    fd,
    { onProgress },
  )
}

export function deleteAttachment(docId: number, attachmentId: number): Promise<void> {
  return apiRequest(`/documents/${docId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  })
}
