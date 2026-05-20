# Architecture

> **Scope:** This document describes the architecture **as currently deployed in production**.
> For the next-phase target architecture (AI-native reflection companion with multi-agent orchestration, vector store, and memory hierarchy), see **[`system-design.md`](system-design.md)**.

## Overview

My Journey is a monolithic full-stack application. The Spring Boot backend serves both the REST API and the static frontend assets from a single deployable JAR.

```
Browser
  │
  ▼
Spring Boot (port 8080)
  ├── Static files (React build output)  →  src/main/resources/static/
  ├── WebSocket (/ws)             →  real-time notifications
  └── REST API (/api/**)
        ├── UserController
        ├── JournalController
        ├── SpaceController
        ├── SpacePostController
        └── NotificationController
              │
              ├── Service Layer (business logic)
              │     ├── UserService
              │     ├── JournalService
              │     ├── SpaceService
              │     ├── SpacePostService
              │     ├── SpacePostReactionService
              │     ├── SpacePostCommentService
              │     ├── NotificationService
              │     ├── RefreshTokenService
              │     ├── AiService              →  Anthropic Claude API
              │     └── CloudStorageService    →  Cloudinary
              │
              └── Repository Layer (JPA)
                    └── MySQL 8
```

## Authentication Flow

```
Client                          Server
  │─── POST /api/login ────────▶│
  │                              │  Validate credentials
  │                              │  Generate JWT (24h) + refresh token (30-day)
  │◀─── { token, refreshToken } ─│
  │
  │─── GET /api/entries/{id}    │
  │    Authorization: Bearer ... │
  │                              │  JwtAuthenticationFilter validates token
  │◀─── entries JSON ───────────│
  │
  │  (token expires / 401)
  │─── POST /api/auth/refresh ──▶│
  │    { refreshToken }          │  Verify + rotate refresh token
  │◀─── { token, refreshToken } ─│  New access token + new refresh token issued
```

Both tokens are stored in `localStorage`. The React API layer (`src/api/`) automatically injects the `Authorization` header and handles silent re-auth on 401 before retrying the original request.

## Data Model

```
user
 ├── id, username (unique), password (bcrypt), email (unique), avatar, created_at

journal_entry
 ├── id, title, content, entry_date
 ├── image_paths (comma-separated Cloudinary URLs)
 └── user_id → user.id

space
 ├── id, name, description, cover_image
 ├── invite_code (unique, 8-char alphanumeric)
 └── owner_id → user.id

space_member
 ├── id, role (OWNER | MEMBER), joined_at
 ├── space_id → space.id
 └── user_id → user.id

space_post
 ├── id, content, image_paths (comma-separated)
 ├── space_id → space.id
 └── user_id → user.id

password_reset_token
 ├── id, username, code (6-digit), expired_at (10 min TTL)

refresh_token
 ├── id, token (unique UUID), user_id → user.id, expires_at (30-day)

space_post_reaction
 ├── id, emoji
 ├── post_id → space_post.id
 └── user_id → user.id

space_post_comment
 ├── id, content, created_at
 ├── post_id → space_post.id
 └── user_id → user.id

notification
 ├── id, type, message, is_read, created_at
 ├── space_id → space.id (nullable)
 └── user_id → user.id
```

## Media Storage

All images and videos go to Cloudinary. Local `uploads/` directory is not used in production.

- Journal images → `my-journey/journals/`
- Space post images/videos → `my-journey/spaces/{spaceId}/`
- User avatars → `my-journey/avatars/`

Image/video URLs are stored as comma-separated strings in the `image_paths` / `video_paths` columns. `getImagePathList()` / `setImagePathList()` on the entity handle serialization.

## Email

Password reset codes are sent via [Resend](https://resend.com) from `noreply@myjourneycloud.com`. The Resend Java SDK (`com.resend:resend-java:3.1.0`) is used directly in `UserService`.

## Deployment

```
GitHub Actions (CI)
  → builds Docker image (Node frontend + Maven backend, multi-stage)
  → pushes to ghcr.io/spring0210/my-journey:latest
  → SSH deploys to DigitalOcean server

DigitalOcean server
  Nginx (443/80) → proxy_pass → localhost:8080
  Docker Compose:
    my-journey-mysql  — MySQL 8.0
    my-journey-app    — Spring Boot JAR (serves API + React static files)
```

All secrets are injected as environment variables at runtime via `.env` at `/opt/my-journey/`. `application.properties` is gitignored. See `docs/deploy.md` for full CI/CD setup.

## WebSocket

STOMP over WebSocket at `/ws`. After login, clients subscribe to `/user/queue/notifications` to receive real-time notification pushes. Replaces the previous 30-second polling approach.

## Database Migrations

Flyway manages versioned SQL migrations under `src/main/resources/db/migration/`. Naming convention: `V{n}__{description}.sql`.

- **V1 (`V1__baseline.sql`)** — baseline schema as of 2026-05-19. Reflects what Hibernate `ddl-auto=update` had produced from the entity classes in `com.myjourney.model` up through commit `e16c4c1` (Phase 6 + Media library).
- **`spring.flyway.baseline-on-migrate=true`** with `baseline-version=1` — on the existing production database (which already has all tables from pre-Flyway `ddl-auto` runs), Flyway records V1 as applied without running it. On fresh dev / test databases, V1 runs normally to create the full schema.
- **`spring.jpa.hibernate.ddl-auto=validate`** — Hibernate verifies entities match the schema on startup but never alters it. Schema changes go through Flyway migrations only. Known historical drift (legacy ENUM types vs VARCHAR, TIMESTAMP vs DATETIME, missing `user.email` UNIQUE, `user.password` NOT NULL on long-lived databases) is tolerated by validate and tracked as cleanup items for a future V2 batch.

Future migrations: `V2__add_document_model.sql` etc. — see Phase 8 work in `docs/superpowers/specs/` (gitignored locally) for the team-KB pivot data model.

## Technology Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Frontend framework | React + TypeScript + Tailwind (Phase 6) | Type safety, component reuse, modern tooling |
| Auth mechanism | JWT + Refresh Token | 24h access token + 30-day rotating refresh |
| Rate limiting | Bucket4j (in-memory) | Login/register/AI endpoints protected against abuse |
| Real-time | WebSocket (STOMP) | Push notifications without polling |
| AI features | Anthropic Claude (Haiku) | Fast, low-cost; used for recap/prompts/search |
| Media storage | Cloudinary | Managed CDN, supports images + videos, easy Java SDK |
| Email provider | Resend | Better deliverability than Gmail SMTP, simple API |
| ORM | Spring Data JPA + Hibernate | Standard Spring ecosystem |
| Calendar | FullCalendar 6 (legacy vanilla JS pages — replaced by React in Phase 6) | Mature, feature-rich |
