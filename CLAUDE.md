# My Journey — Claude Context

## Project
Full-stack journaling app with shared spaces. Java Spring Boot backend + vanilla JS frontend.

## Stack
- Backend: Java 21, Spring Boot 3.4.5, Spring Security (JWT), Spring Data JPA, MySQL 8
- Frontend: Vanilla HTML/CSS/JS, FullCalendar 6
- Storage: Cloudinary (images)
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
JWT stateless, 24h expiration. Token stored in `localStorage`. All `/api/entries/**` and `/api/spaces/**` require `Authorization: Bearer <token>`.

## Current State
Phase 1 (Shared Spaces MVP) is complete. See `docs/roadmap.md` for what's next.

## Conventions
See `docs/conventions.md`.
