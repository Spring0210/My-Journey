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
  // True for the auto-created per-user personal space. Filtered out of /spaces.
  isPersonal: boolean
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
  // True for the auto-created per-user Personal Space. Drives new-doc default type.
  isPersonal: boolean
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
  start: string     // ISO date string "YYYY-MM-DD"
  hasImage: boolean // true if the entry has at least one photo
}

// One day of the year heatmap — count of entries on that date.
export interface HeatmapPoint {
  date: string   // ISO "YYYY-MM-DD"
  count: number
}

// ── Media library ────────────────────────────────────────

// A single tile on the /media page. sourceTitle is the journal entry title
// for JOURNAL items, or a 60-char snippet of post content for SPACE_POST.
export interface MediaResponse {
  id: number
  type: 'IMAGE' | 'VIDEO'
  url: string
  sourceType: 'JOURNAL' | 'SPACE_POST'
  sourceId: number
  sourceDate: string      // "YYYY-MM-DD"
  sourceTitle: string
}

export interface MediaPageResponse {
  items: MediaResponse[]
  nextCursor: string | null  // opaque "YYYY-MM-DD_id" — pass back to /api/media
}

export type MediaTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO'

// ── Documents (team-KB pivot) ─────────────────────────────

export type DocType = 'JOURNAL' | 'NOTE'

// Attachment on a Document — image / PDF / video / file.
export interface DocumentAttachmentResponse {
  id: number
  fileUrl: string
  originalName: string | null
  mimeType: string | null
  sizeBytes: number | null
  position: number | null
  uploadedAt: string   // ISO datetime from LocalDateTime
}

// A comment on a Document (any space member can post).
export interface DocumentCommentResponse {
  id: number
  content: string
  authorId: number
  authorUsername: string
  authorAvatar: string | null
  createdAt: string
}

// Compact list-card view — first ~200 chars of body as snippet.
export interface DocumentSummaryResponse {
  id: number
  title: string
  snippet: string
  docType: DocType
  entryDate: string | null    // "YYYY-MM-DD", only set when docType=JOURNAL
  tags: string[]
  // Up to 4 Cloudinary-resized image thumbnail URLs for the list card strip.
  imageUrls: string[]
  // Total image-attachment count; drives the "+N" overflow tile when > the
  // thumbnails actually rendered.
  imageCount: number
  spaceId: number
  authorId: number
  authorUsername: string
  authorAvatar: string | null
  createdAt: string
  updatedAt: string
}

// Full detail — content (markdown), attachments, comments.
export interface DocumentResponse {
  id: number
  title: string
  content: string
  docType: DocType
  entryDate: string | null
  tags: string[]
  spaceId: number
  spaceName: string
  // True when doc lives in the user's personal space — drives back-nav
  // (→ /journal) on the detail and edit pages.
  spacePersonal: boolean
  authorId: number
  authorUsername: string
  authorAvatar: string | null
  createdAt: string
  updatedAt: string
  attachments: DocumentAttachmentResponse[]
  comments: DocumentCommentResponse[]
}

// Request bodies — used in PR 2 onward, declared now so the API wrapper compiles.
export interface CreateDocumentRequest {
  title: string
  content: string
  docType?: DocType            // server defaults to NOTE
  entryDate?: string | null    // required when docType=JOURNAL
  tags?: string[]
}

export interface UpdateDocumentRequest {
  title?: string
  content?: string
  tags?: string[]
}

// ── Generic API error ─────────────────────────────────────

export interface ApiError {
  status: number
  message: string
}
