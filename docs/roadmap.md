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

## Phase 6 — Frontend Migration ✅ Complete

### Stack
- [x] Migrate from vanilla HTML/CSS/JS to React (Vite) + TypeScript + Tailwind CSS v4
- [x] Build output served from Spring Boot `static/` (single-service deployment, no Docker changes)

### Design System
- [x] Apple HIG-inspired design language — SF Pro font stack, 8pt grid, system blue #007AFF
- [x] Light / dark mode — follows system preference by default, manual toggle in UI
- [x] Tailwind CSS v4 design tokens for colors, spacing, radius, shadow

### Pages
- [x] Landing page — product intro for unauthenticated visitors, CTA to sign up / log in
- [x] Auth pages — Login, Register, Forgot Password, OAuth2 callback
- [x] Journal pages — list, detail, create/edit, calendar view
- [x] Spaces pages — list, space detail, posts, comments, reactions
- [x] Other pages — Dashboard, Notifications, Profile
- [x] Privacy Policy (`/privacy`)
- [x] Terms of Service (`/terms`)
- [x] Footer on all pages with links to Privacy and Terms

### Architecture
- [x] TypeScript types for all API responses and shared data models (`src/types/api.ts`)
- [x] Global auth state via React Context (`userId`, `username`, `avatar`, `token`)
- [x] Typed API wrapper layer (`src/api/`) — no raw `fetch` in components
- [x] Google OAuth frontend (OAuth2CallbackPage — exchanges tokens and populates auth context)

### Module Progress
- [x] Module 1 — Project scaffold (Vite + React + TypeScript + Tailwind v4, SpaController, Dockerfile)
- [x] Module 2 — Global components (AppLayout, PublicLayout, AuthLayout, Sidebar, NavBar, Footer, Icon)
- [x] Module 3 — Landing page
- [x] Module 4 — Auth pages (Login, Register, Forgot Password, OAuth2 callback)
- [x] Module 5 — Journal pages (list, detail, create/edit, calendar)
- [x] Module 6 — Spaces pages (list, detail, posts, comments, reactions)
- [x] Module 7 — Other pages (Profile, Notifications, Dashboard)
- [x] Module 8 — Legal pages (Privacy Policy, Terms of Service)

---

## Deployment — CI/CD via GitHub Actions ✅ Complete

> Full setup guide: `docs/deploy.md`

- [x] Create `.github/workflows/deploy.yml` — build Docker image in CI, push to ghcr.io, SSH deploy to server
- [x] Add GitHub Secrets (`SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `GHCR_TOKEN`)
- [x] Generate deploy SSH key and copy public key to server
- [x] Create GitHub PAT with `read:packages` scope for server image pull
- [x] `docker-compose.yml` uses `image: ghcr.io/spring0210/my-journey:latest`
- [x] Auto-sync `docker-compose.yml` on each deploy via `curl` in workflow script

---

## Phase 7 — Production Hardening

> Reordered to **come before** new feature work. Backups and observability are non-negotiable before adding any new surface area.

### Critical (Week 1)
- [x] **Database backups** — daily server-side cron pushes `backup.sql.gz` to private GitHub repo `Spring0210/my-journey-backup`; git history gives free per-day versioning
- [ ] **Backup hardening** — encrypt dump before push (gpg or `openssl enc -aes-256-cbc`); heartbeat monitor via healthchecks.io (alert if no ping in 26h); monthly restore drill with documented runbook
- [ ] **UptimeRobot** — 5-min HTTPS ping on `/`; email alert on downtime; free tier
- [ ] **Sentry** — backend (Spring Boot) + frontend (React) error capture; free tier sufficient at current scale

### Quality
- [x] **Flyway** — Flyway dependency + `V1__baseline.sql` + `baseline-on-migrate=true` + `ddl-auto=validate` landed in dev (2026-05-19). Future schema changes must go through versioned migrations under `src/main/resources/db/migration/`. Known historical drift (ENUM-vs-VARCHAR for enum columns, TIMESTAMP-vs-DATETIME, missing `user.email` UNIQUE, `user.password` NOT NULL) is tolerated by validate and tracked as cleanup items for a future V2 batch.
- [ ] **Golden-path tests** — JUnit integration tests for auth + entry CRUD + space CRUD; Vitest for the 2–3 most critical frontend utils. Skip exhaustive unit tests — diminishing returns at this scale.
- [ ] **CI test step** — run tests in GitHub Actions before building the Docker image

---

## Phase 8 — Team Knowledge Base + MCP

> **2026-05-19 pivot:** Phase 8 was repositioned again from "Smart Journaling" (mood / tags / on-this-day / reflection-on-save) to a **team knowledge base** with the same backend tools exposed over **MCP** for external clients (Claude Desktop, Cursor). Same 2GB-VPS constraint as before; same "single Claude call per feature" complexity ceiling. Smart-Journaling items below are kept for historical reference but are not on the active backlog.
>
> Sub-projects (in implementation order, per `docs/superpowers/specs/2026-05-19-team-kb-mcp-design.md` §9):
> 1. [x] **Phase 7 closure** — Flyway V1 baseline landed; remaining hardening items (Sentry, UptimeRobot) tracked above
> 2. [x] **Document model migration** — V2/V3 migrations, `Document`/`Comment`/`Attachment` entities + CRUD, legacy tables retired
> 3. [x] **Frontend doc UI** — doc list / detail / editor in spaces + journal redesign on top of new data model
> 4. [x] **Internal AI agent** — `DocumentToolset`, `AgentService` tool-use loop, ChatPanel/ChatDrawer, conversation persistence
> 5. [x] **MCP server** — Streamable-HTTP `POST /mcp`, `mj_<token>` auth, per-token + per-user rate limits, Profile → MCP Access page, audit log, daily maintenance sweep
> 6. [ ] **Polish + docs** — landing page update, README "MCP setup" section (shipped — 530a72d), demo video for portfolio
>
> The original "AI-Native Reflection Companion" architecture (Qdrant + multi-agent orchestrator + L1/L2/L3 memory hierarchy) is preserved in **[`docs/system-design.md`](system-design.md)** and in [Phase 9 — Deferred](#phase-9--deferred--future) below — to be revisited when actual usage signals demand it.

### Original Smart Journaling scope (deprecated 2026-05-19, kept for history)

### 8A — Core product features (no new infrastructure)
- [ ] **Mood selector** — 5–7 emoji moods on entry create; stored as enum on `journal_entry`; powers later trend visualizations
- [ ] **Tag system** — user-defined tags per entry; tag filter in journal list; tag cloud on stats page
- [ ] **Streak counter** — "N days in a row" badge on dashboard; pure SQL aggregate; grace period rules TBD
- [ ] **Daily writing reminder email** — user-configurable time + opt-in toggle in profile; `@Scheduled` cron + existing Resend integration

### 8B — Lightweight AI features (no Qdrant, no embedding model, no new services)
- [ ] **On This Day** — daily cron picks `entry_date = today − 1y / 5y`; in-app card on dashboard + optional email digest
- [ ] **Reflection prompt on save** — opt-in button after entry create → single Haiku call returns 1–3 Socratic follow-up questions; streamed via existing WebSocket
- [ ] **Weekly pattern recap** — Sunday cron samples last 7 days of entries → Haiku summarizes recurring themes / mood shifts; pushed via in-app notification
- [ ] **Smart Search improvements** — keep existing Claude rerank; add result highlighting and a "why this matched" snippet per hit

### 8C — Frontend polish
- [ ] **Skeleton loaders** — replace `"Loading..."` text on Dashboard, Journal List, Space Detail, Notifications
- [ ] **Toast notification system** — unified success/error feedback; replaces inconsistent `alert()` calls
- [ ] **Page transition animations** — Framer Motion spring transitions on route change and modal open
- [ ] **Calendar heatmap** — GitHub-style year-view contribution graph; supplements current month calendar
- [ ] **Reading mode** for journal detail — serif typography, 17pt, 1.7 line height, max 680px width; toggle in detail page
- [ ] **Empty state illustrations** — replace text-only empty states on Dashboard, Spaces, Notifications
- [ ] **Writing stats page** — words written, entries per month, top tags, mood distribution — pure SQL, Apple-Health-style card layout

### 8D — Code health
- [ ] Refactor `SpaceDetailPage.tsx` (1216 lines) into `<PostList>`, `<PostComposer>`, `<MemberList>`, `<InviteModal>` sub-components
- [ ] Extract shared modal/sheet pattern into a reusable `<BottomSheet>` component (used today in journal list AI bar and space invite)

### Why this phase (vs. the original Phase 8 plan)
- **2GB VPS rules out local embedding models** — BGE-M3 alone needs ~2.5GB RAM. Voyage hosted is cheap but Qdrant + Redis on the remaining headroom is still tight, with no measurable user-side win at this scale.
- **MySQL FULLTEXT + Claude rerank handles ~10k entries comfortably** — well past the ~1k–2k entries this app actually has today.
- **Mood / tag / streak / stats deliver user value with zero AI cost** — addressing the real retention problem (users don't come back), not the imagined one (semantic search can't find the right entry).
- **Each AI feature here is a single Claude call**, not a state-machine multi-agent flow. Same product outcome, ~10× less complexity.

---

## Phase 9 — Deferred / Future

> The original "AI-Native Reflection Companion" architecture lives in **[`docs/system-design.md`](system-design.md)** as an aspirational future state. Adopt sub-items below **only when real usage signals demand them** — not pre-emptively.

| Item | Signal that justifies adopting it |
|---|---|
| Voyage AI embedding + Qdrant vector search | Users report FULLTEXT misses cross-language / synonym queries; or > 5k entries per user |
| Custom agent orchestrator with state machine | A use case emerges that genuinely needs multi-step reasoning (e.g., goal tracking with tool calls) |
| L1/L2/L3 memory hierarchy | Caching pressure becomes measurable — p95 latency degrades or LLM context costs spike |
| AES-256-GCM at-rest encryption | Compliance requirement (GDPR DPA, HIPAA) or a paying user explicitly asks |
| Per-user quotas + global daily spend ceiling | Monthly LLM spend approaches the $10 ceiling, or an abuse pattern appears |
| Server upgrade (4GB+) | Any of the above goes live, or memory pressure becomes a real incident |
| Load testing (JMeter) | Onboarding a stakeholder who asks for capacity numbers |
| Mobile native app | PWA install rate plateaus or feature requests need native-only APIs |
| Voice-first capture (Whisper sidecar) | Sustained user request for voice input |

### Conscious choice
Shipping **lower-complexity, higher-leverage features** now, in the actual deployment environment, demonstrates the same engineering judgment as building a multi-agent orchestrator — and produces a working product instead of a half-finished demo. The system-design doc remains as the portfolio narrative for *"how I would scale this if usage demanded it"*.
