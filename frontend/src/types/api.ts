// ─────────────────────────────────────────────────────────
// API response types — mirrors Spring Boot backend models
// ─────────────────────────────────────────────────────────

// ── Auth ─────────────────────────────────────────────────

export interface AuthResponse {
  token: string
  refreshToken: string
  userId: number
  username: string
  avatar: string | null   // backend field name is "avatar", not "avatarUrl"
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

// Returned after PUT /api/profile/{userId}
export interface ProfileResponse {
  username: string
  avatar: string | null
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
  currentPage: number  // 0-indexed, matches backend PageResponse record field
}

// ── Spaces ───────────────────────────────────────────────

// Minimal response from create / update / join / cover-upload operations
export interface SpaceResponse {
  id: number
  name: string
  description: string | null
  inviteCode: string
  coverImage: string | null
}

// Card in the "my spaces" list — includes current user's role
export interface SpaceSummaryResponse {
  id: number
  name: string
  description: string | null
  coverImage: string | null
  inviteCode: string
  role: 'OWNER' | 'MEMBER'
  ownerUsername: string
}

export interface MemberInfo {
  userId: number
  username: string
  avatar: string | null
  role: 'OWNER' | 'MEMBER'
  joinedAt: string
}

// Full detail page response — includes member list
export interface SpaceDetailResponse {
  id: number
  name: string
  description: string | null
  coverImage: string | null
  inviteCode: string
  ownerUsername: string
  members: MemberInfo[]
}

// Emoji reaction summary for a single post
export interface ReactionSummary {
  counts: Record<string, number>   // emoji → count (only emojis with ≥1 reaction)
  myReaction: string | null
}

export interface CommentResponse {
  id: number
  content: string
  authorId: number
  authorUsername: string
  authorAvatar: string | null
  createdAt: string
}

// Full post — includes embedded reactions and comments
export interface PostResponse {
  id: number
  content: string | null
  images: string[]
  videos: string[]
  authorId: number
  authorUsername: string
  authorAvatar: string | null
  createdAt: string
  updatedAt: string
  reactions: ReactionSummary
  comments: CommentResponse[]
}

// ── Notifications ─────────────────────────────────────────

// Matches NotificationResponse record in the backend
// type: "NEW_POST" | "NEW_COMMENT"
export interface Notification {
  id: number
  type: string
  actorUsername: string
  actorAvatar: string | null
  spaceId: number
  spaceName: string
  postId: number
  read: boolean
  createdAt: string   // ISO datetime string from LocalDateTime
}

export interface UnreadCountResponse {
  count: number
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
