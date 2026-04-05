# My Journey — Claude Context

## Project
Full-stack journaling app with collaborative spaces.
Live at [myjourneycloud.com](https://myjourneycloud.com)

## Stack
- **Backend:** Java 21, Spring Boot 3.4.5, Spring Security (JWT + OAuth2), Spring Data JPA, MySQL 8, WebSocket
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4 (Phase 6 migration, modules 1–5 complete)
- **Storage:** Cloudinary (images + videos)
- **Email:** Resend (`noreply@myjourneycloud.com`)
- **AI:** Anthropic Claude (recap, writing prompts, smart search)
- **Deploy:** Docker + Docker Compose + GitHub Actions CI/CD → DigitalOcean

## Key Paths

### Backend
- Controllers: `src/main/java/com/myjourney/controller/`
- Services: `src/main/java/com/myjourney/service/`
- Models: `src/main/java/com/myjourney/model/`
- Config: `src/main/resources/application.properties` (gitignored — contains secrets)
- Docker config: `src/main/resources/application-docker.properties`

### Frontend (React)
- Pages: `frontend/src/pages/`
- Shared components: `frontend/src/components/`
- API wrappers: `frontend/src/api/`
- Types: `frontend/src/types/`
- Design tokens: `frontend/src/styles/tokens.css`
- React build output: `src/main/resources/static/` (served by Spring Boot)

### Old frontend (vanilla JS — still in static/, being replaced by Phase 6)
- `src/main/resources/static/*.html`
- `src/main/resources/static/js/`
- `src/main/resources/static/css/`

## Auth
JWT access token (24h) + refresh token (30-day, stored in DB, rotated on use). Tokens stored in `localStorage`. All `/api/entries/**` and `/api/spaces/**` require `Authorization: Bearer <token>`. Silent re-auth on 401 via `POST /api/auth/refresh`. Google OAuth2 login supported.

## Deployment
GitHub Actions CI/CD: push to `main` → build Docker image → push to `ghcr.io/spring0210/my-journey:latest` → SSH deploy to server at `/opt/my-journey/`. See `docs/deploy.md`.

## Current State
Phases 1–6 (modules 1–5) complete. Phase 6 in progress — Spaces pages (Module 6), other pages (Module 7), legal pages (Module 8) remaining. Phase 7 (Production Hardening) planned. See `docs/roadmap.md`.

## Conventions
See `docs/conventions.md`.

## Design System
See `docs/design-system.md` and `frontend/src/styles/tokens.css`.
