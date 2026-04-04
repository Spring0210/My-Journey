// ─────────────────────────────────────────────────────────
// Spaces API — typed wrappers for all /api/spaces/** endpoints
// ─────────────────────────────────────────────────────────

import { apiRequest, apiRequestWithFile } from './client'
import type {
  SpaceResponse, SpaceSummaryResponse, SpaceDetailResponse,
  PostResponse, CommentResponse, ReactionSummary, PageResponse,
} from '@/types/api'

// ── Spaces ────────────────────────────────────────────────

export function getMySpaces(): Promise<SpaceSummaryResponse[]> {
  return apiRequest('/spaces')
}

export function createSpace(name: string, description: string): Promise<SpaceResponse> {
  return apiRequest('/spaces', { method: 'POST', body: JSON.stringify({ name, description }) })
}

export function joinSpace(inviteCode: string): Promise<SpaceResponse> {
  return apiRequest('/spaces/join', { method: 'POST', body: JSON.stringify({ inviteCode }) })
}

export function getSpaceDetail(spaceId: number): Promise<SpaceDetailResponse> {
  return apiRequest(`/spaces/${spaceId}`)
}

export function updateSpace(spaceId: number, name: string, description: string): Promise<SpaceResponse> {
  return apiRequest(`/spaces/${spaceId}`, { method: 'PUT', body: JSON.stringify({ name, description }) })
}

export function uploadSpaceCover(spaceId: number, file: File): Promise<SpaceResponse> {
  const fd = new FormData()
  fd.append('file', file)
  return apiRequestWithFile(`/spaces/${spaceId}/cover`, fd, 'PUT')
}

export function leaveSpace(spaceId: number): Promise<void> {
  return apiRequest(`/spaces/${spaceId}/leave`, { method: 'POST' })
}

export function deleteSpace(spaceId: number): Promise<void> {
  return apiRequest(`/spaces/${spaceId}`, { method: 'DELETE' })
}

export function kickMember(spaceId: number, memberId: number): Promise<void> {
  return apiRequest(`/spaces/${spaceId}/members/${memberId}`, { method: 'DELETE' })
}

export function generateAiSummary(spaceId: number): Promise<{ summary: string }> {
  return apiRequest(`/spaces/${spaceId}/ai-summary`, { method: 'POST' })
}

// ── Posts ─────────────────────────────────────────────────

export function getPosts(spaceId: number, page = 0, size = 20): Promise<PageResponse<PostResponse>> {
  return apiRequest(`/spaces/${spaceId}/posts?page=${page}&size=${size}`)
}

export function createPost(
  spaceId: number,
  content: string,
  images: File[],
  video: File | null,
): Promise<PostResponse> {
  const fd = new FormData()
  if (content.trim()) fd.append('content', content)
  images.forEach(f => fd.append('images', f))
  if (video) fd.append('videos', video)
  return apiRequestWithFile(`/spaces/${spaceId}/posts`, fd)
}

export function editPost(spaceId: number, postId: number, content: string): Promise<PostResponse> {
  return apiRequest(`/spaces/${spaceId}/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
}

export function deletePost(spaceId: number, postId: number): Promise<void> {
  return apiRequest(`/spaces/${spaceId}/posts/${postId}`, { method: 'DELETE' })
}

// ── Reactions ─────────────────────────────────────────────

export function addReaction(spaceId: number, postId: number, emoji: string): Promise<ReactionSummary> {
  return apiRequest(`/spaces/${spaceId}/posts/${postId}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  })
}

export function removeReaction(spaceId: number, postId: number): Promise<ReactionSummary> {
  return apiRequest(`/spaces/${spaceId}/posts/${postId}/reaction`, { method: 'DELETE' })
}

// ── Comments ──────────────────────────────────────────────

export function addComment(spaceId: number, postId: number, content: string): Promise<CommentResponse> {
  return apiRequest(`/spaces/${spaceId}/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function deleteComment(spaceId: number, postId: number, commentId: number): Promise<void> {
  return apiRequest(`/spaces/${spaceId}/posts/${postId}/comments/${commentId}`, { method: 'DELETE' })
}
