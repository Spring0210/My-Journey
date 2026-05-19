// ─────────────────────────────────────────────────────────
// Media library API — typed wrapper for /api/media.
// Returns a keyset-paginated page of the user's own media,
// unioned across their journal entries and Space posts.
// ─────────────────────────────────────────────────────────

import { apiRequest } from './client'
import type { MediaPageResponse, MediaTypeFilter } from '@/types/api'

// GET /api/media?type={ALL|IMAGE|VIDEO}&cursor=&limit=
//
// cursor: pass back the previous response's nextCursor for the next page,
//         omit it for the first page.
// limit:  server caps at 200, default 60.
export function getMedia(
  type: MediaTypeFilter = 'ALL',
  cursor: string | null = null,
  limit?: number,
): Promise<MediaPageResponse> {
  const params = new URLSearchParams()
  params.set('type', type)
  if (cursor)        params.set('cursor', cursor)
  if (limit != null) params.set('limit', String(limit))
  return apiRequest(`/media?${params.toString()}`)
}
