# MyJourney — System Design Document

> **Status: Aspirational future architecture — NOT the current implementation plan.**
>
> This document describes the architecture MyJourney *would* adopt if usage signals justified it (Qdrant, Redis, local BGE-M3 embedding sidecar, custom agent orchestrator, L1/L2/L3 memory hierarchy, at-rest encryption). It is preserved as a system-design narrative for portfolio / interview purposes — "how I would scale this".
>
> The actual short-term plan ships **lighter-weight features on the existing 2GB VPS** without these components. See **[`roadmap.md`](roadmap.md)** for what is actually being built next (Phase 7 hardening + Phase 8 Smart Journaling).
>
> **Author**: Spring (solo)
> **Live**: [myjourneycloud.com](https://myjourneycloud.com)
> **Last revised**: 2026-05-18 (scope downgraded to aspirational; see roadmap.md for active plan)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Requirements](#3-requirements)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Architecture Decision Records](#5-architecture-decision-records)
6. [Data Model](#6-data-model)
7. [API Design](#7-api-design)
8. [Agent System Deep-Dive](#8-agent-system-deep-dive)
9. [Memory Hierarchy Deep-Dive](#9-memory-hierarchy-deep-dive)
10. [Embedding Pipeline](#10-embedding-pipeline)
11. [Scalability Analysis](#11-scalability-analysis)
12. [Security & Privacy](#12-security--privacy)
13. [Cost Optimization](#13-cost-optimization)
14. [Observability](#14-observability)
15. [Phase Roadmap](#15-phase-roadmap)
16. [Trade-offs & Future Work](#16-trade-offs--future-work)

---

## 1. Overview

### 1.1 Vision

MyJourney started as a generic journaling app. This redesign repositions it as an **AI-native reflection companion** — a product where the value compounds with every entry, not just stores them.

The core insight: **most journals die because users never re-read them**. AI changes that equation by surfacing the right past entry at the right moment, detecting patterns invisible to the writer, and turning a corpus of fragmented entries into a continuous personal narrative.

### 1.2 Why Pivot

| Pain point | Current journals | MyJourney AI-native |
|---|---|---|
| Writer's block | Static prompts | Context-aware Socratic agent |
| No memory recall | Manual scroll | "On this day", semantic search |
| No pattern insight | None | Pattern Agent flags recurring themes |
| Privacy fear | Plaintext storage | Encryption + on-server inference + PII scrubbing |
| Loneliness in journaling | Solo only | Shared "Spaces" — couples, families, accountability partners |

### 1.3 Positioning

Not "Day One + ChatGPT button". The product is the **agent system that lives on top of the corpus**.

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Build a portfolio-grade system that demonstrates **production system-design competence**: multi-service architecture, async pipelines, agent orchestration, RAG, caching, polyglot persistence, cost control.
- Ship to real users on the existing live domain.
- Stay under **$10/month** in LLM/embedding API spend at ~100 users.
- Produce an interview-ready system-design narrative ("walk me through a project you built").

### 2.2 Non-Goals

- Mobile app (web-only; PWA already supports iOS Add to Home Screen).
- Multi-region replication.
- End-to-end encryption (deferred; basic at-rest encryption only in this iteration).
- On-device inference (deferred; future premium feature).
- Multi-tenant org features.

---

## 3. Requirements

### 3.1 Functional

| ID | Requirement |
|---|---|
| F-1 | Users write journal entries (existing). |
| F-2 | New entries auto-embedded into a vector store within 30s (async). |
| F-3 | Semantic search across entire personal corpus (`/api/memory/search`). |
| F-4 | "On this day" agent surfaces relevant past entries on a configurable cadence. |
| F-5 | Reflection Agent responds to a new entry with 1–3 Socratic follow-up questions (streaming). |
| F-6 | Pattern Agent runs nightly, flags recurring themes / mood shifts. |
| F-7 | Recap Agent produces weekly + monthly + yearly summaries. |
| F-8 | Shared Spaces (existing) gain a monthly AI report per space. |
| F-9 | Per-user usage dashboard (token spend, agent runs, quota remaining). |

### 3.2 Non-Functional

| ID | Target | Rationale |
|---|---|---|
| NF-1 | Semantic search p99 < 200 ms (10k entries/user) | Felt-instant UX |
| NF-2 | Reflection Agent first-token < 1.5 s | Streaming UX |
| NF-3 | LLM spend ≤ $10/mo at 100 users | Personal budget |
| NF-4 | New-entry embedding lag < 30 s p95 | "Just-written" entries searchable |
| NF-5 | Zero plaintext journal content in vector DB payload | Privacy |
| NF-6 | Single-region availability ≥ 99% | Hobby SLA |
| NF-7 | Cold-start (DB restart) → service healthy < 60 s | Recovery |

### 3.3 Constraints

- Solo developer; ~10–15 hrs/week.
- Existing stack must be reused where possible (Java 21, Spring Boot 3.4, MySQL 8, React 18). No rewrites.
- Single VPS deployment (DigitalOcean). No managed cloud services beyond Cloudinary, Resend, Anthropic.

---

## 4. High-Level Architecture

### 4.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Frontend (existing)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP + WebSocket (streaming)
┌────────────────────────────▼────────────────────────────────────┐
│                 Spring Boot API Gateway (existing)                │
│  - JWT auth   - Rate limiting   - Request routing                 │
└──┬─────────────┬──────────────┬──────────────┬─────────────────┘
   │             │              │              │
   ▼             ▼              ▼              ▼
┌──────┐  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐
│Entry │  │ Spaces   │  │  Agent       │  │ Memory             │
│Service│ │ Service  │  │ Orchestrator │  │ Service            │
│(CRUD)│  │(existing)│  │   ★ NEW      │  │  ★ NEW             │
└──┬───┘  └────┬─────┘  └──────┬───────┘  └─────────┬──────────┘
   │           │               │                     │
   │           │               ▼                     ▼
   │           │     ┌─────────────────┐    ┌──────────────────┐
   │           │     │ LLM Router      │    │ Embedding        │
   │           │     │ (Haiku/Sonnet/  │    │ Pipeline (async) │
   │           │     │  Opus + cache)  │    │  ★ NEW           │
   │           │     └────────┬────────┘    └──────────┬───────┘
   │           │              │                         │
   │           │              ▼                         ▼
┌──▼───────────▼──┐    ┌─────────────┐         ┌───────────────┐
│   MySQL 8       │    │  Anthropic  │         │   Qdrant      │
│ (entries/users/ │    │   Claude    │         │ (vector DB)   │
│  spaces +       │    │     API     │         │   ★ NEW       │
│  agent_runs +   │    └─────────────┘         └───────────────┘
│  summaries)     │                                    ▲
└─────────────────┘                                    │
         ▲             ┌──────────────────┐            │
         │             │ BGE-M3 Sidecar   │            │
         │             │ (Python embed    ├────────────┘
         │             │  microservice)   │
         │             │  ★ NEW           │
         │             └──────────────────┘
         │
         └──────────────────┬───────────────────────────
                            │
                    ┌───────▼────────┐
                    │  Redis Cache    │
                    │  ★ NEW          │
                    │  - LLM response │
                    │  - Hot entries  │
                    │  - Session ctx  │
                    │  - Job queue    │
                    └─────────────────┘
```

### 4.2 New Components

| Component | Role | Tech |
|---|---|---|
| **Agent Orchestrator** | State-machine that drives multi-agent flows; owns tool dispatch and cost accounting | Java service inside Spring Boot |
| **Memory Service** | RAG retrieval: queries Qdrant + MySQL, ranks results, returns context for agents | Java service inside Spring Boot |
| **LLM Router** | Chooses model tier (Haiku/Sonnet/Opus), applies prompt caching, enforces per-user quota | Java component |
| **Embedding Pipeline** | Listens for new entries, chunks, calls BGE-M3, writes to Qdrant; supports backfill | Spring `@Async` + Redis queue |
| **BGE-M3 Sidecar** | Local embedding inference (multilingual, 1024-dim) | Python FastAPI + sentence-transformers |
| **Qdrant** | Vector store for entry embeddings + payload | Qdrant 1.x OSS, Dockerized |
| **Redis** | LLM response cache, hot-entry cache, simple job queue, rate limit counters | Redis 7, Dockerized |

### 4.3 Critical Request Flows

#### Flow A — Write entry (with async embed)

```
1. Client → POST /api/entries          (existing)
2. EntryService persists row in MySQL  (existing)
3. EntryService publishes event → Redis queue:embed
4. Response returned to client (entry available immediately)
5. Embedding worker (Spring @Async) consumes job:
     5a. PII scrubber redacts emails/phones/addresses
     5b. POST localhost:8000/embed → BGE-M3 sidecar
     5c. Upsert into Qdrant (point_id = entry_id)
     5d. Update journal_embeddings_meta.status = 'done'
6. Reflection Agent triggered (best-effort, fire-and-forget):
     6a. Memory Service retrieves top-k related past entries
     6b. LLM Router → Haiku 4.5 → streaming response → WebSocket /user/queue/reflections
```

#### Flow B — Semantic search

```
1. Client → GET /api/memory/search?q=...
2. MemoryService queries BGE-M3 to embed query
3. Qdrant filtered search (user_id = self) → top 20 candidates
4. Re-rank: vector score × time-decay × theme-match
5. Hydrate from MySQL (or Redis if hot) → return top 10
```

#### Flow C — Nightly Pattern Agent

```
1. Cron @ 03:00 user-local-time
2. PatternAgent reads last 30 days of summaries (L2) + recent entries (L1)
3. LLM Router → Sonnet 4.6 (batch API, 50% off) → emits structured patterns JSON
4. Persist into user_memory_summaries (scope='month')
5. If notable pattern → enqueue notification
```

---

## 5. Architecture Decision Records

### ADR-1 — Vector Store: Qdrant

**Context.** Need a vector store for semantic recall across personal corpora.

**Options considered.**

| Option | Pros | Cons |
|---|---|---|
| **pgvector** in new PostgreSQL | Single transactional store | Forces Postgres alongside MySQL; ops overhead |
| **Redis Stack (vector)** | Reuse Redis | Slower at scale; weaker filtering |
| **Qdrant (OSS, self-hosted)** | Purpose-built, fast HNSW, rich payload filters, single-binary | Adds one more service |
| **Pinecone / Weaviate Cloud** | Fully managed | Monthly cost; against budget |

**Decision.** Qdrant (self-hosted via docker-compose). Story: *polyglot persistence — relational data in MySQL, vector data in Qdrant; each store optimized for its workload.*

**Consequences.** One more container to run and back up; cleaner separation; clear interview narrative.

---

### ADR-2 — Embeddings: Local BGE-M3

**Context.** Need multilingual (Chinese + English) embeddings cheaply.

**Options considered.**

| Option | Cost (100 users) | Multilingual | Decision |
|---|---|---|---|
| OpenAI `text-embedding-3-small` | ~$0.05/mo | OK | Rejected — external dep |
| Voyage AI `voyage-3` | ~$0.10/mo | OK | Rejected — external dep |
| **BGE-M3 local** (BAAI) | $0 (CPU) | Excellent (100+ langs) | **Selected** |

**Decision.** Run BGE-M3 in a Python FastAPI sidecar (`embed:8000`) on the same host. 1024-dim vectors. Entries never leave the server.

**Consequences.** ~1–2 GB RAM footprint for the sidecar. CPU embedding latency ~300 ms/entry — acceptable for async pipeline. Strong privacy story.

---

### ADR-3 — LLM Router & Model Tiering

**Context.** Anthropic offers three tiers (Haiku 4.5 / Sonnet 4.6 / Opus 4.7). Budget is $10/mo.

**Decision.** A `LlmRouter` component routes by task type:

```java
public enum AgentTask {
    REFLECTION_QUICK,     // Haiku 4.5
    REFLECTION_DEEP,      // Sonnet 4.6
    PATTERN_DETECT,       // Sonnet 4.6 (batch)
    RECAP_WEEKLY,         // Sonnet 4.6 (batch)
    RECAP_YEARLY          // Opus 4.7 (rare)
}
```

**Cost levers applied.**
1. **Prompt caching** (Anthropic native, 1h TTL, 90% off on cached input tokens) — user profile + recent-window context cached per session.
2. **Batch API** (50% off, 24h SLA) — for non-interactive Pattern/Recap agents.
3. **Per-user monthly token quota** stored in `agent_runs` aggregation; hard cap → 429.
4. **Global daily spend ceiling** in Redis counter; tripped → 503 with friendly retry message.

---

### ADR-4 — Agent Orchestration: Custom State Machine

**Context.** Need to coordinate 5 agents (reflection, memory, pattern, goal, recap) with shared context and tool use.

**Options considered.**

| Option | Pros | Cons |
|---|---|---|
| **Spring AI Agent** | Native Spring integration | New project, limited agent primitives as of writing |
| **LangChain4j** | Mature primitives | Heavy abstraction; harder to control cost per step |
| **Custom state machine** | Full control, clear interview story, observability built in | More code to write |

**Decision.** Custom orchestrator over Spring AI primitives (use Spring AI only for low-level Anthropic client + tool-binding helpers).

**Why this matters for an interview.** Building the orchestrator surfaces every interesting design question: context window management, retry policy, partial failures, streaming + cancellation, idempotency, cost accounting per step.

```
AgentRun
  ├── inputs: trigger event, user context
  ├── plan:    [step1: MemoryAgent.retrieve, step2: ReflectionAgent.generate]
  ├── state:   PENDING → RUNNING → STREAMING → DONE / FAILED / CANCELLED
  ├── budget:  max_tokens, max_cost_usd
  ├── trace:   [step results, cached?, tokens, latency]
  └── output:  final assistant turn(s)
```

---

### ADR-5 — Memory Hierarchy (L1/L2/L3)

**Context.** Context windows are bounded; cost scales with input tokens. Naively stuffing all entries into every agent call is wasteful and breaks at ~100 entries.

**Decision.** Three-tier memory, analogous to CPU cache hierarchy:

| Tier | Window | Store | Form | Access |
|---|---|---|---|---|
| **L1 — Hot** | last 7 days | Redis | Full plaintext (decrypted on read) | <10 ms |
| **L2 — Warm** | last 90 days | MySQL | Full + per-entry AI summary | <50 ms |
| **L3 — Cold** | all time | Qdrant + MySQL pointer | Embedding + 1-sentence summary in payload | <200 ms semantic |

**Compaction job** runs nightly:
- Entries older than 7 days → evict from L1, ensure L2 summary exists.
- Entries older than 90 days → drop from L2 hot fields, keep only metadata + L3.
- End-of-week / end-of-month / end-of-year → roll-up summaries written to `user_memory_summaries`.

Inspired by MemGPT's hierarchical memory and operating-system page hierarchies.

---

### ADR-6 — Privacy: At-Rest Encryption

**Scope of this iteration.** Basic, not E2E.

**Decision.**
- `journal_entry.content` column stored as AES-256-GCM ciphertext. Key derived per-user from a server-side KMS-equivalent (env-injected master key + per-user salt → HKDF). Future migration path: swap to user-held key for true E2E.
- **Qdrant payload contains no plaintext content** — only `entry_id`, `user_id`, `themes`, and a short AI-generated summary that has been passed through a PII scrubber.
- PII scrubber: regex for emails, phones, addresses, names that look like personal contacts; Haiku 4.5 second-pass confirmation on low-confidence matches.
- HTTPS everywhere (existing). JWT (existing).
- Backup encryption: nightly MySQL dumps encrypted before leaving the host.

**Deferred.** Client-side encryption, on-device inference, "vault" mode.

---

## 6. Data Model

### 6.1 MySQL — New Tables

```sql
-- Tracks embedding pipeline state for each entry. Lets us replay/backfill
-- after a model upgrade and observe pipeline health.
CREATE TABLE journal_embeddings_meta (
  entry_id BIGINT PRIMARY KEY,
  qdrant_point_id VARCHAR(64) NOT NULL,
  embedding_model VARCHAR(64) NOT NULL,    -- e.g. 'bge-m3-1024'
  embedding_version INT NOT NULL,           -- bumped on model swap
  status ENUM('pending','processing','done','failed') NOT NULL,
  pii_detected BOOLEAN DEFAULT FALSE,
  last_error TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_emb_entry FOREIGN KEY (entry_id) REFERENCES journal_entry(id) ON DELETE CASCADE,
  INDEX idx_status (status, updated_at)
);

-- Every agent invocation is logged. Source of truth for cost, latency,
-- quota enforcement, and replay debugging.
CREATE TABLE agent_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  agent_type VARCHAR(32) NOT NULL,         -- 'reflection','memory','pattern','goal','recap'
  trigger_type VARCHAR(32) NOT NULL,       -- 'manual','scheduled','event'
  trigger_ref VARCHAR(64),                 -- e.g. entry_id or cron name
  model VARCHAR(32),                       -- 'haiku-4-5','sonnet-4-6','opus-4-7'
  input_tokens INT,
  cached_input_tokens INT,
  output_tokens INT,
  cost_usd DECIMAL(10,6),
  duration_ms INT,
  status VARCHAR(16),                      -- 'success','failed','cancelled','quota_exceeded'
  error TEXT,
  trace_json JSON,                         -- step-by-step trace for debugging
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_time (user_id, created_at),
  INDEX idx_user_month (user_id, (DATE_FORMAT(created_at, '%Y-%m')))
);

-- AI-generated summaries at multiple scopes. Used as L2/L3 memory and
-- as inputs to Pattern / Recap agents.
CREATE TABLE user_memory_summaries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  scope ENUM('entry','week','month','year') NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  summary_text TEXT NOT NULL,              -- encrypted (AES-256-GCM)
  themes JSON,                             -- ["work_stress","family","fitness"]
  mood_distribution JSON,                  -- {"joy":0.3,"anxiety":0.2,...}
  source_entry_count INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_scope_period (user_id, scope, period_start)
);

-- Tracks user-stated goals so Goal Agent can ask "you said you'd do X — how's it going?"
CREATE TABLE user_goals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  goal_text VARCHAR(500) NOT NULL,         -- extracted from entries
  source_entry_id BIGINT,                  -- where the goal was first stated
  status ENUM('active','paused','done','dropped') DEFAULT 'active',
  last_checkin_at TIMESTAMP,
  due_at DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_status (user_id, status)
);
```

### 6.2 Encryption Migration

`journal_entry.content` (existing) is migrated from `LONGTEXT` plaintext to `LONGBLOB` ciphertext via a one-time backfill job. Application code reads/writes through an `EncryptedStringConverter` (JPA `AttributeConverter`).

### 6.3 Qdrant Collection

```
Collection: journal_entries
  vector_size: 1024
  distance:    Cosine
  payload:
    user_id: int                 (indexed, filter)
    entry_id: int
    entry_date: int              (epoch days, range filter)
    themes: keyword[]            (indexed)
    summary: text                (≤200 chars, post-PII)
    lang: keyword                ('en','zh','mixed')
```

Two payload indexes: `user_id` (must), `themes` (recommended). All searches filtered by `user_id` — multi-tenant isolation enforced at the query layer.

### 6.4 Redis Layout

```
session:{userId}:context                  HASH    L1 hot entries digest (TTL 1h)
entry:{entryId}                           STRING  decrypted content (TTL 24h, LRU)
quota:user:{userId}:tokens:{YYYY-MM}      STRING  monthly counter
quota:global:spend:{YYYY-MM-DD}           STRING  daily spend ceiling
llm:cache:{sha256(prompt)}                STRING  response cache (TTL 1h)
job:embed:queue                           LIST    pending embedding jobs
job:embed:processing:{workerId}           STRING  in-flight lease
agent:run:{runId}:stream                  STREAM  SSE/WebSocket relay buffer
```

---

## 7. API Design

### 7.1 New Endpoints

```
POST   /api/agents/reflect
  body: { entryId }
  → SSE stream of reflection tokens
  → side-effect: AgentRun row + WebSocket push on /user/queue/reflections

GET    /api/memory/search?q=...&limit=10&themes=...
  → [{ entryId, snippet, score, entryDate, themes }]

GET    /api/memory/on-this-day?date=YYYY-MM-DD
  → relevant past entries (anniversary + thematic match)

GET    /api/memory/recap?scope=week|month|year&period=2026-05
  → { summary, themes, moodDistribution, highlights[] }

POST   /api/memory/reindex
  admin-only; triggers full backfill of embedding pipeline

GET    /api/agents/runs?limit=50
  → recent AgentRun rows for the current user

GET    /api/usage/me
  → { tokensThisMonth, costUsdThisMonth, quotaTokens, quotaCostUsd }

POST   /api/goals
GET    /api/goals
PATCH  /api/goals/{id}
```

### 7.2 Streaming Contract

Reflection responses stream via **Server-Sent Events** (over the existing HTTP API) so the React side can render token-by-token. The WebSocket channel is reused for *push* events (notifications from Pattern Agent, On-This-Day delivery) but not for interactive request/response — keeping concerns separate.

---

## 8. Agent System Deep-Dive

### 8.1 Agent Interface

```java
public interface Agent<I, O> {
    AgentType type();
    AgentResult<O> run(AgentContext ctx, I input);   // synchronous flavor
    Flux<AgentEvent> stream(AgentContext ctx, I input); // streaming flavor
    List<Tool> tools();
}
```

`AgentContext` carries: `userId`, `runId`, `parent runId` (for sub-agent calls), `budget` (max tokens/cost), `cancellation token`, `trace sink`.

### 8.2 The Five Agents

| Agent | Trigger | Model | Tools |
|---|---|---|---|
| **ReflectionAgent** | New entry created (event) | Haiku 4.5 (quick) or Sonnet 4.6 (deep, user-toggled) | `memory.search`, `goal.list` |
| **MemoryAgent** | Called by other agents | Haiku 4.5 (ranking only) | `vector.search`, `mysql.fetch` |
| **PatternAgent** | Nightly cron, per-user | Sonnet 4.6 (batch) | `summary.fetch`, `summary.write` |
| **GoalAgent** | Weekly + event-driven | Haiku 4.5 | `goal.crud`, `notification.send` |
| **RecapAgent** | End-of-week/month/year cron | Sonnet (week/month), Opus (year) | `summary.fetch`, `summary.write` |

### 8.3 Orchestrator State Machine

```
        ┌──────────┐
        │  PLAN    │  (decide which agents + tools, build context)
        └────┬─────┘
             │
        ┌────▼─────┐
        │ EXECUTE  │──cancel──▶┌───────────┐
        └────┬─────┘            │ CANCELLED │
             │                  └───────────┘
        ┌────▼─────┐
        │ STREAM   │  (emit tokens; persist to Redis stream)
        └────┬─────┘
             │
       success / failure
             │
        ┌────▼─────┐
        │ FINALIZE │  (write AgentRun, settle cost, emit completion event)
        └──────────┘
```

### 8.4 Tool Use

Tools follow Anthropic's tool-use schema. Each tool is a typed Java method exposed via a small `@Tool` annotation processor that emits the JSON schema sent to Claude.

```java
@Tool(name = "memory.search",
      description = "Search the user's past entries by semantic similarity")
public List<EntrySnippet> memorySearch(
    @ToolParam("query") String query,
    @ToolParam("limit") int limit
) { ... }
```

### 8.5 Cost Accounting Per Run

Every call site to `LlmRouter.invoke()` returns a usage record. The orchestrator aggregates per-run usage and writes one `agent_runs` row at finalization. This makes:

- Per-user monthly quota enforceable from `agent_runs` aggregation.
- Cost regressions visible in the `/api/usage/me` dashboard.
- Replays cheap to diagnose ("show me the most expensive run last week").

### 8.6 Failure Modes & Retries

| Failure | Strategy |
|---|---|
| Anthropic 429 (rate limit) | Exponential backoff with jitter, max 3 retries |
| Anthropic 5xx | Same; circuit-break after 5 consecutive failures |
| Streaming connection drop | Buffer in Redis stream — client reconnects, replays from offset |
| Budget exceeded mid-run | Cancel cleanly, finalize with `status='quota_exceeded'`, surface to user |
| Tool call malformed | One auto-correction round (feed error back to model); else fail step |

---

## 9. Memory Hierarchy Deep-Dive

### 9.1 Why a Hierarchy

A user with 2 years of daily entries has ~700 entries. Stuffing them into every agent call costs **tens of thousands of input tokens per invocation** — incompatible with both context windows and budget.

Instead, the orchestrator builds context dynamically per task:

```
context budget = 8000 tokens
  ├── system prompt + agent identity          ~500 tokens
  ├── L1 hot entries (last 7 days, full)      ~2000 tokens
  ├── L2 warm summaries (last 90 days)        ~1500 tokens
  ├── L3 retrieved relevant entries (top-k)   ~3000 tokens   (← RAG)
  └── recent agent turns                       ~1000 tokens
```

### 9.2 Compaction Pipeline

Runs nightly @ 04:00 host time:

```
1. For each user with entries > 7 days old not yet summarized:
     a. Generate per-entry summary (cached Haiku call, ~50 tokens output each)
     b. Persist into user_memory_summaries (scope='entry')

2. For entries older than 90 days:
     a. Verify L3 (Qdrant) presence
     b. Drop full plaintext from Redis L1 cache forcibly (in case stuck)

3. On Sunday: produce weekly summary from previous 7 days of entries
   On 1st of month: produce monthly summary from previous 4 weekly summaries
   On Jan 1: produce yearly summary from previous 12 monthly summaries

Hierarchical rollup keeps context cost O(log time) instead of O(time).
```

### 9.3 Search Ranking

```
final_score = α · cosine_similarity
            + β · time_decay(entry_date)        // half-life 180 days, but
                                                // boost on anniversaries
            + γ · theme_overlap(query, entry)
            + δ · recency_bonus_if_thread       // entries in same thread

α=0.7, β=0.15, γ=0.10, δ=0.05    (tuned, not learned — v1)
```

The "on this day" feature uses the same scorer but with `time_decay` replaced by an anniversary kernel that spikes at year boundaries.

---

## 10. Embedding Pipeline

### 10.1 Sequence

```
Producer (EntryService)                   Consumer (EmbeddingWorker)
       │                                            │
   create entry                                     │
       │                                            │
   insert journal_embeddings_meta (status=pending)  │
       │                                            │
   LPUSH job:embed:queue {entry_id}                 │
       │                                            │  BRPOPLPUSH ... processing
       │                                            │
       │                                       PII scrub
       │                                            │
       │                                       POST embed sidecar
       │                                            │
       │                                       Qdrant upsert
       │                                            │
       │                                       UPDATE meta status=done
       │                                            │
       │                                       LREM from processing
```

Idempotency: `qdrant_point_id` is deterministic (= `entry_id`), so duplicate consumes are safe.

### 10.2 Backpressure & Failure

- Visibility timeout on `processing` list — janitor re-queues stale jobs every 5 min.
- 3 retries; after that → `status='failed'` + admin alert.
- Backfill endpoint walks rows where `status != 'done'` and re-enqueues — used after model upgrade.

### 10.3 Why Async, Not Sync

If we embedded synchronously inside `POST /api/entries`, a slow sidecar (cold start, GC) would block the user's save. Decoupling keeps the write path snappy and isolates the LLM-side complexity.

---

## 11. Scalability Analysis

### 11.1 Today (Target Capacity)

| Metric | Target |
|---|---|
| Users | 100 |
| Entries / user / month | ~10 |
| Total entries | ~12k |
| Qdrant size | ~50 MB |
| MySQL size | ~200 MB |
| Peak QPS | <5 |
| LLM spend | <$5/mo |

A single 2 vCPU / 4 GB VPS handles this comfortably.

### 11.2 Path to 10k Users (10× growth)

Bottlenecks predicted in order of arrival:

1. **BGE-M3 sidecar CPU** — 300 ms/entry, single-threaded. Scale: multi-worker uvicorn, or move to GPU if hot. Cost: still free if shared CPU.
2. **MySQL connection pool** — Tune HikariCP, add read replica for analytics queries.
3. **Redis memory** — L1 cache eviction policy `allkeys-lru`, monitor hit rate.
4. **LLM spend** — Quota system already in place; if business model permits, charge tier.
5. **Qdrant single-node** — Still fits one node at 1M+ vectors; cluster mode if needed.

### 11.3 Path to 100k Users (1000×)

Requires real changes:

- **Sharding strategy**: shard by `user_id`. Qdrant supports sharded collections natively. MySQL: range-shard `user_id` blocks across DB instances; entry-level rows always co-locate with the user row.
- **Embedding pipeline → dedicated worker pool** with Kafka or RabbitMQ replacing Redis list. Workers horizontally scale on entry volume.
- **Agent orchestrator → its own service**, separate JVM, can be scaled independently from the API tier.
- **CDN for static assets** — front the React build behind Cloudflare.
- **Database read replicas** — search, recap dashboards read from replicas.
- **Multi-region** considered only at this scale.

### 11.4 Failure Domains

| Failure | Blast radius | Mitigation |
|---|---|---|
| Qdrant down | Search degrades; entries still save; no embeds | Show degraded-mode banner; pipeline backs up in Redis |
| Redis down | LLM cache miss → costs spike; queue blocked | Quota service falls back to MySQL counter; circuit-break agents |
| Anthropic outage | Agents unavailable; CRUD still works | Cached responses serve "on this day"; reflection paused |
| MySQL down | Hard down | Daily encrypted backup; restore < 30 min target |
| BGE-M3 sidecar down | New entries queue, search still works on existing index | Auto-restart via Docker; SLA loose |

---

## 12. Security & Privacy

### 12.1 Threat Model

| Actor | Capability | Mitigation |
|---|---|---|
| Anonymous internet | None | HTTPS + JWT |
| Other user | Cross-user data access | All queries filtered by `user_id` at service layer; Qdrant payload `user_id` filter enforced |
| Server operator (me) | Could read plaintext if I tried | At-rest encryption with env-injected key; not in DB. Honest-but-curious assumption documented. |
| LLM provider (Anthropic) | Sees prompt content | PII scrubbed in payload; full-entry text only sent under user-initiated requests; logged for audit |
| Stolen DB dump | Plaintext extraction | AES-256-GCM ciphertext; key not in dump |
| Stolen Qdrant snapshot | Embedding inversion | Possible in theory; mitigated by PII scrubbing of payload and summary |

### 12.2 Key Management

- Master encryption key in environment variable `ENCRYPTION_MASTER_KEY` (existing pattern).
- Per-user data encryption key (DEK) derived via HKDF(master, user_id_salt). DEKs never persisted.
- Key rotation: new `key_version` column on encrypted tables; re-encrypt-on-read migration.

### 12.3 PII Scrubber

```
Stage 1 — Regex pass: emails, phone numbers (intl. + cn), URLs, IDs that look like SSNs.
Stage 2 — Named-entity pass: Haiku 4.5 prompt
          "Mark all personal names, addresses, employer names. Return spans."
Stage 3 — Replace each span with category token: [PERSON], [ADDRESS], etc.
Stage 4 — Compute confidence; if < 0.7, skip embedding and re-queue for human review.
```

Stage 2 runs only on entries flagged by Stage 1, keeping cost negligible.

---

## 13. Cost Optimization

### 13.1 Anthropic Cost Levers Applied

| Lever | Mechanism | Estimated impact |
|---|---|---|
| Prompt caching | Cache user profile + recent context block | −90% input cost on cache hits |
| Model routing | Haiku for 90% of tasks | 5–15× cheaper than Sonnet |
| Batch API | Pattern + Recap agents run in 24h batch | −50% per batched call |
| Context budget per agent | Hard cap input tokens at design time | Bounds worst case |
| Output token cap | `max_tokens` enforced per agent | Bounds runaway responses |
| Caching responses | Redis cache by `sha256(prompt)` | Free re-reads within 1h TTL |
| Per-user quota | Hard 429 at quota | Bounds heavy users |

### 13.2 Monthly Budget Model (100 users)

```
Reflection Agent (Haiku):
  100 users × 5 entries × (300 cached input + 600 fresh input + 400 output)
  = 100 × 5 × (~$0.0006)
  ≈ $0.30/mo

Pattern Agent (Sonnet batch):
  100 users × 1 run × (3000 cached + 2000 fresh + 1500 output) × 0.5 (batch)
  ≈ $1.50/mo

Recap Agent (Sonnet batch, weekly + monthly):
  100 users × 5 runs × similar
  ≈ $1.50/mo

Recap Agent (Opus yearly):
  100 users × 1/12 month × ~5k tokens
  ≈ $0.40/mo

Buffer:                       ~$2/mo

Total estimated:              ~$5.70/mo
Hard ceiling enforced:        $10/mo
```

### 13.3 Failure-Open vs Failure-Closed

When budget is hit:
- **Failure-closed** on async agents (Pattern, Recap): skip the run, log it, resume next cycle.
- **Failure-open** on user-initiated search (semantic search uses local embedding — cost-free).
- **Friendly error** on user-initiated reflection: "Quota for this month reached — resets in N days. Search still works."

---

## 14. Observability

### 14.1 Metrics (Micrometer → /actuator/prometheus)

```
journal.entries.created.total            counter
journal.embeddings.pipeline.latency      histogram, labels: status
journal.embeddings.queue.depth           gauge
agent.runs.total                         counter, labels: agent_type, status
agent.runs.duration.ms                   histogram, labels: agent_type, model
agent.tokens.input.total                 counter, labels: model, cached
agent.tokens.output.total                counter, labels: model
agent.cost.usd.total                     counter, labels: model
memory.search.duration.ms                histogram
memory.search.qdrant.hits                histogram
llm.cache.hits / .misses                 counter
quota.exceeded.total                     counter, labels: scope=user|global
```

### 14.2 Tracing

OpenTelemetry on a key set of spans: `entry.write → embed.scrub → embed.sidecar → embed.qdrant`, and `agent.run → memory.search → llm.call`. Solo project so collector is local Jaeger.

### 14.3 Dashboards

Three Grafana boards:
1. **Health** — error rates, latency, queue depth.
2. **Cost** — daily spend, per-model breakdown, top users.
3. **Engagement** — entries/day, agent runs/user, search usage.

---

## 15. Phase Roadmap

| Phase | Duration | Deliverables | Demonstrates |
|---|---|---|---|
| **A — Infrastructure** | 1 wk | Qdrant + Redis containers; BGE-M3 sidecar; encryption converter; `agent_runs`, `journal_embeddings_meta`, `user_memory_summaries` tables; this design doc finalized. | Polyglot persistence, infrastructure design |
| **B — Embedding Pipeline** | 1 wk | Async pipeline, PII scrubber, backfill endpoint, retry/janitor. | Async pipelines, idempotency, queues |
| **C — Semantic Search** | 0.5 wk | `/api/memory/search`, ranking algorithm, React search page. | RAG basics, ranking |
| **D — Agent Orchestrator** | 1.5 wk | Custom state machine, LLM Router, tool framework, cost tracking, streaming. | Multi-agent design, cost engineering |
| **E — Reflection + Memory Agents** | 1 wk | First end-to-end agent flow; entry-create event triggers reflection. | Tool use, RAG-in-agent |
| **F — On-This-Day** | 1 wk | Scheduled job, anniversary kernel, email + in-app push. | Cron, ranking, notifications |
| **G — Pattern + Recap Agents** | 1.5 wk | Batch API integration, weekly summaries, monthly dashboard. | Batch processing, hierarchical summarization |
| **H — Memory Hierarchy** | 1 wk | L1/L2/L3 split, compaction job, summary cascade. | OS-inspired memory design |
| **I — Spaces × AI** | 1 wk | Monthly AI report per Space (couples/family templates). | Multi-tenant data, shared context |
| **J — Encryption + Quotas** | 0.5 wk | `journal_entry.content` migration, per-user monthly quotas, daily ceiling. | Security migrations, rate limiting |
| **K — System Design Doc + Load Test** | 1 wk | JMeter scripts, results, finalize doc, README polish for portfolio. | Capacity planning, communication |

**Total**: ~11 weeks @ ~10–15 hrs/wk solo.

---

## 16. Trade-offs & Future Work

### 16.1 Conscious Trade-offs

| Decision | Trade-off |
|---|---|
| Self-hosted Qdrant, not managed | Saves $; adds ops burden |
| Local BGE-M3, not API | Saves $; CPU latency higher; quality slightly below Voyage |
| Custom orchestrator, not LangChain4j | More code; better control + interview story |
| Single VPS, not Kubernetes | Simpler; lower availability ceiling |
| Server-side encryption keys, not E2E | Faster to ship; not zero-trust |
| Tuned (not learned) search ranking | Simple, debuggable; misses ML upside |

### 16.2 Future Work

1. **Voice-first capture** — Whisper sidecar; talk to the journal.
2. **On-device inference option** — premium tier; Ollama with small model.
3. **Goal accountability proactive nudges** — Goal Agent push notifications.
4. **Learned ranking** — train a small re-ranker on user click-through.
5. **Shared-Space therapist read-only access** — coach/therapist persona, audit log.
6. **Mobile native app** — at scale, beyond PWA.
7. **Migration to managed Postgres + pgvector** if Qdrant ops become onerous.

---

## Appendix A — Glossary

- **L1/L2/L3**: Memory tiers, by analogy to CPU cache hierarchy.
- **RAG**: Retrieval-Augmented Generation — fetching relevant context before LLM call.
- **HNSW**: Hierarchical Navigable Small World — ANN graph algorithm Qdrant uses.
- **HKDF**: HMAC-based Key Derivation Function.
- **DEK**: Data Encryption Key (per-user).
- **PII**: Personally Identifiable Information.

## Appendix B — Reading List (for interviews)

- *Designing Data-Intensive Applications*, Martin Kleppmann — sharding, replication.
- MemGPT paper — hierarchical memory for LLMs.
- Anthropic's prompt caching docs — current canonical reference.
- Qdrant filtering & payload index docs.
