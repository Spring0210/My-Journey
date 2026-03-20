# Architecture

## Overview

My Journey is a monolithic full-stack application. The Spring Boot backend serves both the REST API and the static frontend assets from a single deployable JAR.

```
Browser
  │
  ▼
Spring Boot (port 8080)
  ├── Static files (HTML/CSS/JS)  →  src/main/resources/static/
  └── REST API (/api/**)
        ├── UserController
        ├── JournalController
        ├── SpaceController
        └── SpacePostController
              │
              ├── Service Layer (business logic)
              │     ├── UserService
              │     ├── JournalService
              │     ├── SpaceService
              │     ├── SpacePostService
              │     └── CloudStorageService  →  Cloudinary
              │
              └── Repository Layer (JPA)
                    └── MySQL 8
```

## Authentication Flow

```
Client                          Server
  │─── POST /api/login ────────▶│
  │                              │  Validate credentials
  │                              │  Generate JWT (24h, HMAC-SHA256)
  │◀─── { token, userId } ──────│
  │
  │─── GET /api/entries/{id}    │
  │    Authorization: Bearer ... │
  │                              │  JwtAuthenticationFilter validates token
  │◀─── entries JSON ───────────│
```

JWT is stored in `localStorage` on the client. The `api.js` utility automatically injects the `Authorization` header on every request.

## Data Model

```
user
 ├── id, username (unique), password (bcrypt), email, created_at

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
```

## Image Storage

All images go to Cloudinary. Local `uploads/` directory is not used in production.

- Journal images → `my-journey/journals/`
- Space post images → `my-journey/spaces/{spaceId}/`

Image URLs are stored as comma-separated strings in the `image_paths` column. `getImagePathList()` / `setImagePathList()` on the entity handle serialization.

## Email

Password reset codes are sent via [Resend](https://resend.com) from `noreply@myjourneycloud.com`. The Resend Java SDK (`com.resend:resend-java:3.1.0`) is used directly in `UserService`.

## Deployment

Docker Compose starts two containers:
- `db` — MySQL 8.0
- `app` — Spring Boot JAR

All secrets (JWT secret, Cloudinary credentials, Resend API key) are injected as environment variables at runtime. `application.properties` is gitignored.

## Technology Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Frontend framework | None (vanilla JS) | Simplicity, no build step |
| Auth mechanism | JWT (stateless) | No server-side session management needed |
| Image storage | Cloudinary | Managed CDN, easy Java SDK, free tier |
| Email provider | Resend | Better deliverability than Gmail SMTP, simple API |
| ORM | Spring Data JPA + Hibernate | Standard Spring ecosystem |
| Calendar | FullCalendar 6 | Mature, feature-rich, easy integration |
