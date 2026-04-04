// ─────────────────────────────────────────────────────────
// API response types — mirrors Spring Boot backend models
// ─────────────────────────────────────────────────────────

// ── Auth ─────────────────────────────────────────────────

export interface AuthResponse {
  token: string
  refreshToken: string
  userId: number
  username: string
  avatarUrl: string | null
}

export interface RefreshResponse {
  token: string
  refreshToken: string
}

// ── User ─────────────────────────────────────────────────

export interface User {
  id: number
  username: string
  email: string
  avatarUrl: string | null
  createdAt: string
}

// ── Journal ──────────────────────────────────────────────

export interface JournalEntry {
  id: number
  title: string
  content: string | null
  entryDate: string        // "YYYY-MM-DD" from LocalDate
  imagePaths: string | null   // raw comma-separated (backend storage field)
  imagePathList: string[]     // parsed array — use this in components
}

export interface PageResponse<T> {
  content: T[]
  totalPages: number
  totalElements: number
  number: number       // current page (0-indexed)
  size: number
  last: boolean
}

// ── Spaces ───────────────────────────────────────────────

export interface Space {
  id: number
  name: string
  description: string | null
  coverImageUrl: string | null
  inviteCode: string
  ownerUsername: string
  memberCount: number
  createdAt: string
}

export interface SpacePost {
  id: number
  spaceId: number
  content: string
  imageUrls: string[]
  videoUrls: string[]
  authorUsername: string
  authorAvatarUrl: string | null
  reactionCount: number
  commentCount: number
  userReaction: string | null
  createdAt: string
  updatedAt: string
}

export interface PostResponse extends SpacePost {}

export interface SpacePostComment {
  id: number
  postId: number
  content: string
  authorUsername: string
  authorAvatarUrl: string | null
  createdAt: string
}

// ── Notifications ─────────────────────────────────────────

export interface Notification {
  id: number
  type: string
  message: string
  read: boolean
  referenceId: number | null
  createdAt: string
}

// ── AI ───────────────────────────────────────────────────

export interface RecapResponse {
  recap: string
}

export interface PromptResponse {
  prompt: string
}

export interface SearchResponse {
  results: JournalEntry[]
  query: string
}

// ── Calendar ──────────────────────────────────────────────

export interface CalendarEvent {
  id: number
  title: string
  start: string  // ISO date string "YYYY-MM-DD"
}

// ── Generic API error ─────────────────────────────────────

export interface ApiError {
  status: number
  message: string
}
