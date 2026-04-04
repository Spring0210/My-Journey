# Roadmap

## Phase 1 — Shared Spaces MVP ✅ Complete

### Backend
- [x] Space entity and database table
- [x] SpaceMember entity (membership + roles: OWNER / MEMBER)
- [x] Invite code generation (8-char alphanumeric, SecureRandom)
- [x] Space CRUD API (create / read / update / delete)
- [x] Member management API (join via invite code, leave, delete space)
- [x] SpacePost entity with text + multi-image support
- [x] SpacePost CRUD API (create, paginated read, delete)
- [x] Role-based access control (owner-only operations)

### Frontend
- [x] Spaces list page (spaces.html)
- [x] Create space modal
- [x] Join space via invite code modal
- [x] Space detail page with post timeline (space.html)
- [x] Post composer (text + image upload)
- [x] Invite code display
- [x] Edit space info (owner only)
- [x] Leave / delete space actions
- [x] Image lightbox with navigation
- [x] Post image stored in JS Map (prevents browser freeze)

### Auth & Account
- [x] JWT authentication (24h expiration, subject = userId)
- [x] Login via username or email
- [x] Email uniqueness enforced on registration
- [x] Email format validation on registration (frontend + backend)
- [x] Password reset via email verification code (Resend + myjourneycloud.com)
- [x] User avatar support (Cloudinary, `my-journey/avatars/`)
- [x] Profile page — change username and avatar
- [x] Sidebar extracted to layout.js (single source of truth for all pages)

---

## Phase 2 — Experience Polish

### Social Features
- [x] Post reactions (like / emoji)
- [x] Comments on space posts
- [x] In-app notifications (new post / new comment); sidebar badge with 30s polling; delete single / clear all

### Spaces Improvements
- [x] Space cover image upload
- [x] Kick member from space (owner only)
- ~~Space permission tiers (read-only member vs posting member)~~
- ~~Space search / discovery (public spaces)~~

### Journal Improvements
- [~] Rich text editor for journal entries — decided against; plain text fits journaling better
- [ ] Tag / mood system for entries
- [x] Export entries as PDF

### Account
- [x] User profile page (avatar, username)
- [x] Change password from settings
- ~~Bio / display name field~~

### Bug Fixes & Security (done in Phase 2)
- [x] Fix login failure after DTO refactor (checked wrong response field)
- [x] Hide BCrypt password hash from journal API responses (@JsonIgnore)
- [x] Unified error handling via GlobalExceptionHandler + AppException
- [x] Replace System.out/err with SLF4J logging
- [x] Fix post/comment timestamps (ZoneOffset.UTC + JVM TZ=UTC in Docker)
- [x] Fix post deletion FK constraint (delete reactions/comments first)

---

## Phase 3 — Video Support

- [x] Cloudinary video upload integration
- [x] Video player component in space posts
- [x] Upload progress bar for large files
- [ ] Video player component in journal entries
- ~~Video thumbnail generation~~

---

## Phase 4 — AI Features

> Model: `claude-haiku-4-5` for all features (fast + low cost). Upgrade to `claude-sonnet-4-6` for search if needed.

### Recap
- [x] Space Recap — AI-generated summary of recent space activity (all members can trigger)
- [x] Journal Monthly Recap — summarize a month's entries into a warm personal reflection

### Writing Prompts
- [x] Personalized journal prompts based on recurring themes in recent entries (not generic prompts)

### Smart Search
- [x] Natural language search over journal entries ("find entries about my mom")

~~Auto-generate short video from images + text~~ — not differentiated; CapCut/Reels do this better

---

## Phase 5 — Backend Hardening

### Features
- [x] Space post editing (author or owner only)
- [x] Real-time notifications via WebSocket (replace 30s polling)
- [x] Google OAuth 2.0 login (Spring Security OAuth2 + JWT exchange; account linking by email)

### Security & Reliability
- [x] API rate limiting (Bucket4j in-memory — 10/min on login, 5/min on register/forgot-password, 5/min per user on AI endpoints)
- [x] JWT refresh token (30-day refresh token in DB; silent re-auth on 401; token rotation on each use)

---

## Phase 6 — Frontend Migration

### Stack
- [x] Migrate from vanilla HTML/CSS/JS to React (Vite) + TypeScript + Tailwind CSS v4
- [x] Build output served from Spring Boot `static/` (single-service deployment, no Docker changes)

### Design System
- [x] Apple HIG-inspired design language — SF Pro font stack, 8pt grid, system blue #007AFF
- [x] Light / dark mode — follows system preference by default, manual toggle in UI
- [x] Tailwind CSS v4 design tokens for colors, spacing, radius, shadow

### Pages
- [ ] Landing page — product intro for unauthenticated visitors, CTA to sign up / log in
- [ ] Auth pages — Login, Register, Forgot Password, OAuth2 callback
- [ ] Journal pages — list, detail, create/edit, calendar view
- [ ] Spaces pages — list, space detail, posts, comments, reactions
- [ ] Other pages — Dashboard, Notifications, Profile
- [ ] Privacy Policy (`/privacy`)
- [ ] Terms of Service (`/terms`)
- [x] Footer on all pages with links to Privacy and Terms

### Architecture
- [x] TypeScript types for all API responses and shared data models (`src/types/api.ts`)
- [x] Global auth state via React Context (`userId`, `username`, `avatar`, `token`)
- [x] Typed API wrapper layer (`src/api/`) — no raw `fetch` in components
- [ ] Google OAuth frontend (completes Phase 5 OAuth work)
- [ ] PWA support — Web App Manifest + Service Worker (installable on mobile/desktop)

### Module Progress
- [x] Module 1 — Project scaffold (Vite + React + TypeScript + Tailwind v4, SpaController, Dockerfile)
- [x] Module 2 — Global components (AppLayout, PublicLayout, AuthLayout, Sidebar, NavBar, Footer, Icon)
- [x] Module 3 — Landing page
- [ ] Module 4 — Auth pages (Login, Register, Forgot Password, OAuth2 callback)
- [ ] Module 5 — Journal pages (list, detail, create/edit, calendar)
- [ ] Module 6 — Spaces pages (list, detail, posts, comments, reactions)
- [ ] Module 7 — Other pages (Profile, Notifications, Dashboard)
- [ ] Module 8 — Legal pages (Privacy Policy, Terms of Service)
