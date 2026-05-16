# My Journey — Claude Context

## Project
Full-stack journaling app with collaborative spaces.
Live at [myjourneycloud.com](https://myjourneycloud.com)

## Stack
- **Backend:** Java 21, Spring Boot 3.4.5, Spring Security (JWT + OAuth2), Spring Data JPA, MySQL 8, WebSocket
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4
- **Storage:** Cloudinary (images + videos)
- **Email:** Resend (`noreply@myjourneycloud.com`)
- **AI:** Anthropic Claude — Haiku 4.5 today for recap/prompts/smart-search; Phase 8 introduces a multi-agent reflection system (Haiku/Sonnet/Opus tiered routing). See `docs/system-design.md`.
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

### Legacy frontend (vanilla JS — deprecated, scheduled for removal)
- `src/main/resources/static/*.html`
- `src/main/resources/static/js/`
- `src/main/resources/static/css/`
- Do not add new features here. React (`frontend/`) is the only active frontend.

## Auth
JWT access token (24h) + refresh token (30-day, stored in DB, rotated on use). Tokens stored in `localStorage`. All `/api/entries/**` and `/api/spaces/**` require `Authorization: Bearer <token>`. Silent re-auth on 401 via `POST /api/auth/refresh`. Google OAuth2 login supported.

## Deployment
GitHub Actions CI/CD: push to `main` → build Docker image → push to `ghcr.io/spring0210/my-journey:latest` → SSH deploy to server at `/opt/my-journey/`. See `docs/deploy.md`.

## Current State
Phases 1–6 complete and live in production. Next major arc: **Phase 8 — AI-Native Reflection Companion** (multi-agent reflection, RAG over personal corpus via Qdrant + BGE-M3, hierarchical memory, ≤ $10/mo LLM budget). Phase 7 (Production Hardening) runs as a parallel track. See `docs/roadmap.md`.

## System Design
The target architecture for Phase 8 — Qdrant vector store, Redis cache, local BGE-M3 embedding sidecar, custom agent orchestrator, L1/L2/L3 memory hierarchy, encryption at rest — is fully specified in **`docs/system-design.md`**. Refer to it before designing new backend work; refer to `docs/architecture.md` for the as-deployed architecture.

## Conventions
See `docs/conventions.md`.

## Design System
See `docs/design-system.md` and `frontend/src/styles/tokens.css`.
