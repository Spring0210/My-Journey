# My Journey — Claude Context

## Project
Full-stack journaling app with shared spaces. Java Spring Boot backend + React (TypeScript) frontend (migrating in Phase 6).

## Stack
- Backend: Java 21, Spring Boot 3.4.5, Spring Security (JWT), Spring Data JPA, MySQL 8
- Frontend: Vanilla HTML/CSS/JS, FullCalendar 6 → migrating to React + TypeScript + Tailwind CSS v4 (Phase 6)
- Storage: Cloudinary (images + videos)
- Email: Resend (`noreply@myjourneycloud.com`)
- Deploy: Docker + Docker Compose

## Key Paths
- Controllers: `src/main/java/com/myjourney/controller/`
- Services: `src/main/java/com/myjourney/service/`
- Models: `src/main/java/com/myjourney/model/`
- Frontend JS: `src/main/resources/static/js/`
- Frontend HTML: `src/main/resources/static/`
- Config: `src/main/resources/application.properties` (gitignored — contains secrets)

## Auth
JWT access token (24h) + refresh token (30-day, stored in DB, rotated on use). Tokens stored in `localStorage`. All `/api/entries/**` and `/api/spaces/**` require `Authorization: Bearer <token>`. Silent re-auth on 401 via `POST /api/auth/refresh`.

## Current State
Phases 1–5 complete. Phase 6 (Frontend Migration to React + TypeScript + Tailwind) is next. See `docs/roadmap.md`.

## Conventions
See `docs/conventions.md`.
