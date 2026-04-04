// ─────────────────────────────────────────────────────────
// User / Profile API — typed wrappers for /api/profile and
// /api/change-password endpoints.
// ─────────────────────────────────────────────────────────

import { apiRequest, apiRequestWithFile } from './client'
import type { ProfileResponse } from '@/types/api'

// PUT /api/profile/{userId} — update username and/or avatar.
// Both fields are optional; pass null to skip.
export function updateProfile(
  userId: number,
  username: string | null,
  avatarFile: File | null,
): Promise<ProfileResponse> {
  const fd = new FormData()
  if (username !== null) fd.append('username', username)
  if (avatarFile)        fd.append('avatar',   avatarFile)
  return apiRequestWithFile(`/profile/${userId}`, fd, 'PUT')
}

// POST /api/change-password/send-code — email a 6-digit code to the user
export function sendChangePasswordCode(): Promise<void> {
  return apiRequest('/change-password/send-code', { method: 'POST' })
}

// PUT /api/change-password — verify code and set new password
export function changePassword(code: string, newPassword: string): Promise<void> {
  return apiRequest('/change-password', {
    method: 'PUT',
    body: JSON.stringify({ code, newPassword }),
  })
}
