# MyJourney

A full-stack personal journaling app with collaborative spaces.
Live at [myjourneycloud.com](https://myjourneycloud.com)

## Features

### Journal
- Create, edit, and delete dated entries with rich text and multiple images
- Search entries by keyword, date, or natural language (AI)
- Monthly calendar view — dates with entries highlighted
- Monthly Recap — AI-generated personal reflection
- Personalized writing prompts based on recent themes
- Export entries as PDF

### Shared Spaces
- Create a space and invite others via an 8-character invite code
- Post content with images and videos to a shared timeline
- Reactions, comments, and real-time notifications via WebSocket
- Space owner controls: edit info, remove members, delete posts

### Account
- JWT authentication (24h access token + 30-day refresh token, rotated on use)
- Google OAuth 2.0 login
- Password reset via email (Resend)
- Avatar upload, username change, password change

## Tech Stack

### Backend
- **Java 21** + **Spring Boot 3.4.5**
- **Spring Security** — JWT filter + OAuth2
- **Spring Data JPA** + **Hibernate** + **MySQL 8**
- **WebSocket** — real-time notifications
- **Cloudinary** — image and video storage
- **Resend** — transactional email (`noreply@myjourneycloud.com`)
- **Anthropic Claude** — AI recap, writing prompts, smart search
- **Bucket4j** — API rate limiting

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS v4** + Apple HIG design system
- Light / dark mode (follows system preference)

### Infrastructure
- **Docker + Docker Compose** — containerized deployment
- **GitHub Actions** — CI/CD: build image → push to ghcr.io → auto-deploy
- **Nginx** — reverse proxy + HTTPS (Let's Encrypt)
- **DigitalOcean** — single droplet (2 GB RAM, Ubuntu 22.04)

## Project Structure

```
my-journey/
├── src/main/java/com/myjourney/
│   ├── config/       # Security, Cloudinary, WebSocket config
│   ├── controller/   # REST controllers (HTTP layer only)
│   ├── service/      # Business logic
│   ├── model/        # JPA entities
│   ├── repository/   # Spring Data JPA interfaces
│   ├── filter/       # JWT authentication filter
│   └── util/         # JwtUtil, helper classes
├── src/main/resources/
│   ├── static/       # React build output (served by Spring Boot)
│   ├── application.properties
│   └── application-docker.properties
├── frontend/         # React + TypeScript source
│   ├── src/
│   │   ├── components/   # Shared UI components
│   │   ├── pages/        # Route-level components
│   │   ├── api/          # Typed fetch wrappers
│   │   ├── context/      # React Context (auth state)
│   │   ├── hooks/        # Custom hooks
│   │   ├── types/        # TypeScript interfaces
│   │   └── styles/       # Global CSS + design tokens
│   └── vite.config.ts
├── docs/             # Design system, conventions, roadmap, deploy guide
├── Dockerfile        # Multi-stage: Node (frontend) → Maven (backend) → JRE
└── docker-compose.yml
```

## Local Development

### Prerequisites
- Java 21+, Maven 3.9+
- Node.js 22+
- MySQL 8 (or use Docker)

### Run backend

1. Copy `application.properties.example` and fill in secrets (Cloudinary, Resend, Anthropic, Google OAuth, JWT)
2. `mvn spring-boot:run`

### Run frontend (dev server with hot reload)

```bash
cd frontend
npm install
npm run dev        # starts at localhost:5173, proxies /api to localhost:8080
```

### Run everything with Docker

```bash
cp .env.example .env   # fill in secrets
docker compose up --build
```

## Deployment

CI/CD via GitHub Actions — push to `main` triggers an automatic build and deploy.

See `docs/deploy.md` for the full setup guide.

**Manual deploy (if needed):**
```bash
ssh root@myjourneycloud.com
cd /opt/my-journey
docker compose pull && docker compose up -d --remove-orphans
```

## Docs

| File | Contents |
|---|---|
| `docs/conventions.md` | Naming, architecture, UX, and coding rules |
| `docs/design-system.md` | Apple HIG design spec — colors, typography, components |
| `docs/roadmap.md` | Phase-by-phase feature history and upcoming work |
| `docs/deploy.md` | CI/CD setup, branch workflow, troubleshooting |

## License

MIT
