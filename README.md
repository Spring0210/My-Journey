# MyJourney

> **One Java toolset, three surfaces.** A personal and team knowledge base where every document is reachable by an AI agent — from the web, from the REST API, or from any external MCP client (Claude Desktop, Cursor) over Anthropic's open Model Context Protocol.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-myjourneycloud.com-success)](https://myjourneycloud.com)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](#)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4-6db33f.svg)](#)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](#)
[![MCP](https://img.shields.io/badge/MCP-2025--03--26-8a3ffc.svg)](#)

**Live**: [myjourneycloud.com](https://myjourneycloud.com)

---

## What it is

MyJourney started as a personal journaling app and grew into an AI-native knowledge base for small teams. Every user gets a Personal Space; teams collaborate in Shared Spaces. The same documents you write in the browser are also reachable by an in-app AI agent and — as of the latest release — by any external LLM client speaking the **Model Context Protocol**, Anthropic's open spec for letting language models use external tools.

The interesting part is what's *not* duplicated. The web chat agent, the REST API, and the MCP server all delegate to a single `DocumentToolset` interface in Java. Adding a tenth tool means writing one method; all three surfaces pick it up automatically, with the same access checks and the same audit story.

---

## How it works

```
React PWA              React PWA              Claude Desktop, Cursor,
(chat drawer)          (rest of app)          and other MCP clients
     │                       │                          │
     ▼                       ▼                          ▼
 AgentService          REST controllers           McpJsonRpcController
 (Anthropic            (JWT + OAuth2 +            (JSON-RPC 2.0, mj_
  tool-use loop,        refresh-token             bearer tokens, rate
  SSE streaming,        rotation)                  limited + audited)
  multimodal)
     │                       │                          │
     └───────────────────────┼──────────────────────────┘
                             ▼
                  ┌────────────────────────┐
                  │   DocumentToolset      │
                  │   9 tools — single     │
                  │   Java interface for   │
                  │   read / write logic   │
                  └────────────────────────┘
                             │
                             ▼
              MySQL 8 (FULLTEXT) · Cloudinary · Anthropic Claude
```

The nine tools cover the entire read/write surface for documents, spaces, and comments: `search_documents`, `get_document`, `list_documents`, `list_spaces`, `get_comments`, `create_document`, `update_document`, `add_comment`, `create_space`. Same JSON shape, same membership checks, three transports.

---

## Three surfaces

### 1. Web agent (`AgentService`)

The in-app chat drawer on every Space page. A single Anthropic tool-use loop over Haiku 4.5, streaming partial responses back to the React client over SSE. Multimodal — paste an image or a PDF into the chat and the agent reads it through Anthropic's vision and document-input modes. Conversations persist per `(user, space)` so threads can be resumed.

### 2. REST API (`/api/**`)

JWT access token (24h) plus a 30-day refresh token (DB-backed, rotated on use). Google OAuth2 sign-in. All `/api/entries/**` and `/api/spaces/**` are authenticated and rate-limited per endpoint with Bucket4j. Consumed exclusively by the React PWA — the MCP path uses a different bearer scheme so a leaked browser token never grants tool access.

### 3. MCP server (`POST /mcp`)

A hand-rolled JSON-RPC 2.0 endpoint implementing the slice of MCP Streamable HTTP that tool-only servers actually need: `initialize`, `tools/list`, `tools/call`, `ping`, and the `notifications/initialized` no-op. External LLM clients authenticate with a long-lived `mj_` bearer token created in `Profile → MCP Access` (raw token shown exactly once; only its SHA-256 is stored). Two rate-limit tiers — 60 req/min/token and 1000 req/day/user — with `Retry-After` on 429. Every tool call is recorded to `mcp_access_log` with a 30-day retention sweep.

Wiring it into Claude Desktop is a single config-file paste:

```json
{
  "mcpServers": {
    "my-journey": {
      "url": "https://myjourneycloud.com/mcp",
      "headers": { "Authorization": "Bearer mj_<your token>" }
    }
  }
}
```

---

## Tech Stack

**Backend** — Java 21 · Spring Boot 3.4 · Spring Security (JWT + OAuth2) · Spring Data JPA · Flyway · MySQL 8 · WebSocket (STOMP) · Bucket4j · Anthropic Java SDK · Cloudinary · Resend

**Frontend** — React 18 · TypeScript · Vite · Tailwind CSS v4 · Apple HIG design tokens · Installable PWA

**AI** — Anthropic Claude Haiku 4.5 (vision + PDF + tool-use). Tool-use loop, no orchestrator, no embeddings, no vector DB — designed to run comfortably on a 2 GB VPS.

**Infra** — Docker + Docker Compose · GitHub Actions CI/CD · GitHub Container Registry · Nginx (HTTPS via Let's Encrypt) · DigitalOcean (single droplet)

---

## Docs

| File | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | As-deployed architecture |
| [`docs/roadmap.md`](docs/roadmap.md) | Phase-by-phase history and the team-KB + MCP pivot |
| [`docs/api-spec.md`](docs/api-spec.md) | REST API reference |
| [`docs/conventions.md`](docs/conventions.md) | Naming, architecture, UX, and coding conventions |
| [`docs/design-system.md`](docs/design-system.md) | Apple HIG design spec — colors, typography, components |
| [`docs/deploy.md`](docs/deploy.md) | CI/CD setup, branch workflow, troubleshooting |
| [`docs/system-design.md`](docs/system-design.md) | Aspirational deep-dive — how I would scale this to 100k users with a vector store, agent orchestrator, and memory hierarchy |

---

<details>
<summary><strong>Local Development</strong></summary>

### Prerequisites
- Java 21+, Maven 3.9+
- Node.js 22+
- MySQL 8 (or use Docker)

### Run backend
1. Copy `application.properties.example` and fill in secrets (Cloudinary, Resend, Anthropic, Google OAuth, JWT).
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
