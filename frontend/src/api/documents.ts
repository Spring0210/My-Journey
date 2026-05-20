// ─────────────────────────────────────────────────────────
// Documents API — typed wrappers for /api/spaces/{id}/documents
// and /api/documents/{id}** endpoints.
// PR 1 surfaces read + comment + delete only.
// Create / update / attachment upload land in PR 2-3.
// ─────────────────────────────────────────────────────────

import { apiRequest } from './client'
import type {
  DocumentResponse,
  DocumentSummaryResponse,
  DocumentCommentResponse,
  DocumentAttachmentResponse,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  PageResponse,
  DocType,
} from '@/types/api'

// ── Documents: list & read ────────────────────────────────

// Paginated list of documents in a space; optional docType filter ("JOURNAL"|"NOTE").
export function listDocuments(
  spaceId: number,
  opts: { type?: DocType; page?: number; size?: number } = {},
): Promise<PageResponse<DocumentSummaryResponse>> {
  const params = new URLSearchParams()
  if (opts.type) params.set('type', opts.type)
  params.set('page', String(opts.page ?? 0))
  params.set('size', String(opts.size ?? 20))
  return apiRequest(`/spaces/${spaceId}/documents?${params.toString()}`)
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

// ── Attachments (read-only in PR 1) ───────────────────────

export function listDocumentAttachments(docId: number): Promise<DocumentAttachmentResponse[]> {
  return apiRequest(`/documents/${docId}/attachments`)
}
