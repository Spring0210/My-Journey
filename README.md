# MyJourney

> **An AI-native reflection companion that turns a lifetime of private thoughts into compounding insight — solo, or with the people who matter.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-myjourneycloud.com-success)](https://myjourneycloud.com)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](#)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4-6db33f.svg)](#)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](#)
[![Anthropic](https://img.shields.io/badge/AI-Claude%204.x-8a3ffc.svg)](#)

**Live**: [myjourneycloud.com](https://myjourneycloud.com)  ·  **Design**: [System Design Document](docs/system-design.md)

---

## The Pitch

Most journals die because users never re-read them. MyJourney is built on the opposite premise: **every entry should compound**. A multi-agent system reads your past, asks Socratic follow-ups, surfaces patterns you can't see yourself, and recalls the right moment from years ago — all from a private corpus that never leaves the server.

You can keep it solo, or invite the people who matter into shared **Spaces** with their own AI-curated reports — for couples, families, accountability partners.

The product is the agent system that lives on top of the corpus, not a UI for writing.

## Screenshots

> Screenshots coming soon. Try the live app at [myjourneycloud.com](https://myjourneycloud.com).

---

## Architecture at a Glance

```
React (PWA)  ─→  Spring Boot (JWT, WebSocket, Rate Limit)
                    ├─→ MySQL 8           Relational: users, entries, spaces
                    ├─→ Qdrant            Vector store + payload filters   [Phase 8]
                    ├─→ Redis             Hot cache, queue, quotas         [Phase 8]
                    ├─→ BGE-M3 sidecar    Local multilingual embedding     [Phase 8]
                    ├─→ Anthropic Claude  Haiku 4.5 / Sonnet 4.6 / Opus 4.7
                    └─→ Cloudinary, Resend
```

What makes this interesting to an engineer:

- **Polyglot persistence.** MySQL for relational data, Qdrant for vectors, Redis for hot state — each store optimized for its workload, not one stretched across all of them.
- **Custom multi-agent orchestrator.** Five specialized agents (Reflection / Memory / Pattern / Goal / Recap) coordinated by a state machine with per-step cost accounting, tool dispatch, and streaming + cancellation.
- **Three-tier memory hierarchy.** L1 Redis (last 7 days, full text) · L2 MySQL (last 90 days, full + summary) · L3 Qdrant (all time, embedding + summary). Nightly compaction cascades entries down the tiers. Inspired by OS memory hierarchies and the MemGPT paper.
- **Cost-engineered LLM pipeline.** Anthropic prompt caching (~90% off cached inputs), model tier routing, Batch API (50% off) for non-interactive agents, per-user monthly token quota, global daily spend ceiling — hard cap of **$10/month at ~100 users**.
- **Privacy-first.** AES-256-GCM at-rest encryption on entry content, PII scrubber before embedding, embedding model runs locally (BGE-M3 multilingual). No plaintext, no PII ever leaves the server.
- **Async embedding pipeline.** Entries embed asynchronously via a Redis-backed queue with retry/janitor for stuck jobs; idempotent on point IDs so duplicate consumes are safe.

Full design with ADRs, data model, scalability path to 100k users, threat model, observability, and cost analysis: **[`docs/system-design.md`](docs/system-design.md)**.

---

## Features

### Live today

- **Journal** — dated entries with multi-image uploads, calendar view, AI-assisted monthly recap, personalized writing prompts, natural-language search, PDF export
- **Shared Spaces** — invite-only shared timelines (8-char invite code), posts with images/videos, reactions, threaded comments, real-time notifications via WebSocket
- **Account** — JWT auth (24h access + 30-day rotating refresh), Google OAuth 2.0, password reset via email (Resend), avatar upload
- **Mobile** — installable PWA (iOS Add to Home Screen), responsive design verified at 390px, light/dark mode

### Phase 8 — AI-Native Reflection (in development)

- **"Past You" agent** — on the anniversary of any entry, automatically surface what you wrote then and what AI noticed about it
- **Multi-agent reflection** — five agents coordinated by a state machine, triggered by entry creation, scheduled cron, or explicit user request
- **Semantic recall** — search a lifetime of entries by meaning, not keywords; bilingual (English + Chinese) via BGE-M3
- **Pattern detection** — nightly batch agent surfaces recurring themes, mood shifts, behavioral signals
- **Goal accountability** — agent extracts goals from entries and proactively follows up
- **Hierarchical recap** — weekly / monthly / yearly summaries that cascade from finer to coarser grain
- **Shared-Space AI reports** — monthly AI-curated summaries per Space (couples / family / accountability templates)

Full sub-phase plan A–K: [`docs/roadmap.md`](docs/roadmap.md).

---

## Tech Stack

### Backend
**Java 21** · Spring Boot 3.4 · Spring Security (JWT + OAuth2) · Spring Data JPA · MySQL 8 · WebSocket (STOMP) · Bucket4j (rate limit) · Cloudinary · Resend · Anthropic Claude SDK · **Qdrant** *(Phase 8)* · **Redis** *(Phase 8)*

### Frontend
**React 18** · TypeScript · Vite · Tailwind CSS v4 · Apple HIG design tokens · React Context (auth/theme) · Installable PWA

### AI / Embedding
Anthropic Claude — **Haiku 4.5 / Sonnet 4.6 / Opus 4.7** with tier routing · **BGE-M3** multilingual embeddings via a local Python sidecar *(Phase 8)*

### Infrastructure
Docker + Docker Compose · GitHub Actions CI/CD · GitHub Container Registry · Nginx (HTTPS via Let's Encrypt) · DigitalOcean (single droplet, 2 GB RAM)

---

## Docs

| File | Contents |
|---|---|
| [`docs/system-design.md`](docs/system-design.md) | **Target architecture (Phase 8)** — multi-agent system, RAG, memory hierarchy, scalability, threat model, cost model |
| [`docs/architecture.md`](docs/architecture.md) | Current as-deployed architecture |
| [`docs/roadmap.md`](docs/roadmap.md) | Phase-by-phase feature history (1–6 shipped) and upcoming work (7, 8) |
| [`docs/api-spec.md`](docs/api-spec.md) | REST API reference |
| [`docs/conventions.md`](docs/conventions.md) | Naming, architecture, UX, and coding conventions |
| [`docs/design-system.md`](docs/design-system.md) | Apple HIG design spec — colors, typography, components |
| [`docs/deploy.md`](docs/deploy.md) | CI/CD setup, branch workflow, troubleshooting |

---

<details>
<summary><strong>Local Development</strong></summary>

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

### Deployment
CI/CD via GitHub Actions — push to `main` triggers an automatic build and deploy. See [`docs/deploy.md`](docs/deploy.md) for the full setup guide.

**Manual deploy (if needed):**
```bash
ssh root@myjourneycloud.com
cd /opt/my-journey
docker compose pull && docker compose up -d --remove-orphans
```

</details>

---

## License

MIT
