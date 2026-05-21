# My Journey — Claude Context

## Project
Full-stack journaling app with collaborative spaces.
Live at [myjourneycloud.com](https://myjourneycloud.com)

## Stack
- **Backend:** Java 21, Spring Boot 3.4.5, Spring Security (JWT + OAuth2), Spring Data JPA, MySQL 8, WebSocket
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4
- **Storage:** Cloudinary (images + videos)
- **Email:** Resend (`noreply@myjourneycloud.com`)
- **AI:** Anthropic Claude — Haiku 4.5 for all features. Two surfaces: (1) one-shot `AiService` calls for recap, writing prompts, search-keyword expansion, space summary; (2) the in-app agent chat (`agent/AgentService`) — a single-call tool-use loop with 9 tools mapped onto `DocumentService`. No orchestrator, no embeddings, no vector DB.
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
Phases 1–6 complete and live in production. The internal agent (per-space + cross-space chat, ChatDrawer mobile UI, 9 tools incl. `create_space`, multimodal images+PDF) shipped on top of Phase 6.

**Phase 7 (Production Hardening): mostly done.** Backups (daily MySQL dump → private `Spring0210/my-journey-backup` repo), Flyway migrations (7 versions, `baseline-on-migrate`), and `/actuator/health` (used as a CI/CD health gate) are live. Remaining: Sentry (not wired) and signing up for an external uptime monitor against `/actuator/health` (no code change).

**Phase 8 has been replaced by the Team KB + MCP pivot** (`docs/superpowers/specs/2026-05-19-team-kb-mcp-design.md`): the same `DocumentService` tools the agent uses will be exposed via an MCP Streamable-HTTP transport with dedicated API tokens. Smart-journaling features (on-this-day, reflection-on-save, weekly pattern) are dropped in favor of the MCP direction.

Deploy target is a **2GB VPS**, which rules out local embedding models / Qdrant / Redis in the current iteration — those are deferred to Phase 9 in `docs/roadmap.md`.

## System Design
`docs/system-design.md` describes an **aspirational future architecture** (Qdrant + BGE-M3 + agent orchestrator + L1/L2/L3 memory + encryption at rest). It is **not the current implementation plan** — see the banner at the top of that file. The actual plan is in `docs/roadmap.md`. The system-design doc is preserved as the portfolio narrative for "how I would scale this if usage demanded it". `docs/architecture.md` documents the as-deployed architecture.

## Conventions
See `docs/conventions.md`.

## Design System
See `docs/design-system.md` and `frontend/src/styles/tokens.css`.
