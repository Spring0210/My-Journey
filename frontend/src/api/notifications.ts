// ─────────────────────────────────────────────────────────
// Notifications API — typed wrappers for /api/notifications
// ─────────────────────────────────────────────────────────

import { apiRequest } from './client'
import type { Notification, UnreadCountResponse } from '@/types/api'

// GET /api/notifications — all notifications for the current user
export function getNotifications(): Promise<Notification[]> {
  return apiRequest('/notifications')
}

// GET /api/notifications/unread-count
export function getUnreadCount(): Promise<UnreadCountResponse> {
  return apiRequest('/notifications/unread-count')
}

// POST /api/notifications/mark-read — mark all as read
export function markAllRead(): Promise<void> {
  return apiRequest('/notifications/mark-read', { method: 'POST' })
}

// DELETE /api/notifications/{id} — delete a single notification
export function deleteNotification(id: number): Promise<void> {
  return apiRequest(`/notifications/${id}`, { method: 'DELETE' })
}

// DELETE /api/notifications — delete all notifications
export function deleteAllNotifications(): Promise<void> {
  return apiRequest('/notifications', { method: 'DELETE' })
}
