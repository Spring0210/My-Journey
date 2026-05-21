# Team Knowledge Base + MCP — Pivot Design

**Date:** 2026-05-19
**Status:** Draft (pending user review)
**Type:** Major repositioning of existing journaling product
**Replaces:** Phase 8 "Smart Journaling" lightweight scope (see roadmap.md). Phase 7 (Production Hardening) remains a prerequisite and is unchanged.

---

## 0. Pivot Summary

My Journey transitions from "AI-assisted personal journaling app with shared spaces" to:

> **A small-team AI-native knowledge base, accessible from both the Web UI and any MCP client (Claude Desktop, Cursor, etc).**

The existing journal + spaces data model becomes the foundation. Spaces become team knowledge bases. Every user gets an auto-created Personal Space that holds their journal-type documents. A single `Document` entity unifies what used to be journal entries and space posts. An internal AI agent (Claude Haiku 4.5 with tool-use loop) helps users search, summarize, and write inside their KB. The same tools are exposed as an MCP server so external agents can do the same workflows from outside the Web UI.

**Why this story works on a 2GB VPS:** No vector DB, no local embedding model, no orchestrator. MCP server runs inside the same Spring Boot process. Multimodal is handled by Anthropic Haiku's built-in vision + PDF input — zero local compute.

**Why this story works on a portfolio:** Same tool set powers both Web chat and external MCP integration. One coherent narrative ("everything is a Document; the agent uses 8 tools; MCP exposes those same 8 tools") instead of a buzzword salad.

---

## 1. Core Decisions (made during brainstorming, locked)

| Decision | Choice |
|----------|--------|
| Direction | B + C: small-team KB + MCP server (no D agent platform, no A pure-personal) |
| Content shape | Doc-first (markdown body, title, tags) with file attachments |
| Editing model | Author-only edit; all space members can read + comment |
| Journal evolution | Merged into `Document`; every user has an auto-created Personal Space holding `doc_type=JOURNAL` documents |
| AI agent architecture | Tool-use loop via Anthropic SDK (NOT a custom orchestrator) |
| Internal Web chat scope | Per-space chat (default scope = current space) |
| MCP transport | Streamable HTTP (per MCP 2025 spec); via `io.modelcontextprotocol:mcp-java-sdk` |
| MCP auth | Dedicated API tokens (NOT JWT); user-generated in Profile, 30-day default, revocable |
| Multimodal scope | Images + PDF (via Haiku vision + Anthropic PDF input). No audio, no local OCR |
| Deferred items | Real-time collaborative editing, embeddings/Qdrant, document version history, voice |

---

## 2. Architecture

```
                  ┌────────────────────────────────────────┐
                  │       Spring Boot (port 8080)          │
                  │                                        │
   Browser ──────▶│  REST /api/**                          │
                  │   ├── DocumentController               │
                  │   ├── SpaceController (existing)       │
                  │   ├── CommentController                │
                  │   ├── AgentChatController (new)        │
                  │   └── McpTokenController (new)         │
                  │                                        │
   Claude Desktop │  MCP /mcp  (Streamable HTTP)           │
   Cursor      ──▶│   └── McpServerAdapter                 │
   other MCP cli  │       (delegates to DocumentService)   │
                  │                                        │
                  │  Service Layer                         │
                  │   ├── DocumentService  ◀── single      │
                  │   ├── AgentService  ──┐    source of   │
                  │   ├── CommentService  │    truth       │
                  │   ├── SpaceService     │               │
                  │   └── CloudStorage     │               │
                  │                        │               │
                  │  WebSocket /ws (existing notifications)│
                  └────────────────────────────────────────┘
                              │
                              ▼
                  MySQL 8  (FULLTEXT search on documents)
                  Cloudinary  (images / videos / PDFs / files)
                  Anthropic Claude Haiku 4.5  (vision + PDF + rerank + chat)
```

Key property: **REST controllers, MCP adapter, and internal AI agent all call the same `DocumentService` interface.** Zero duplicated business logic across the three surfaces.

---

## 3. Data Model

### 3.1 New / modified tables

```
space  (existing — minor change)
 ├── id, name, description, cover_image
 ├── invite_code (unique, 8-char) — NULL for personal spaces (no invite needed)
 ├── owner_id → user.id
 ├── is_personal BOOLEAN DEFAULT false   (new — true for auto-created personal spaces)
 └── created_at

document  (new — supersedes journal_entry and space_post-as-content)
 ├── id
 ├── title           VARCHAR(255) NOT NULL
 ├── content         MEDIUMTEXT NOT NULL          -- markdown body
 ├── doc_type        ENUM('JOURNAL','NOTE') NOT NULL DEFAULT 'NOTE'
 ├── entry_date      DATE NULL                    -- used by JOURNAL docs; powers calendar / On This Day
 ├── tags            JSON NOT NULL DEFAULT (JSON_ARRAY())  -- array of strings, lowercase, normalized
 ├── space_id        BIGINT NOT NULL → space.id   -- never null; personal docs go in user's personal space
 ├── author_id       BIGINT NOT NULL → user.id
 ├── created_at      TIMESTAMP
 ├── updated_at      TIMESTAMP
 └── FULLTEXT INDEX (title, content)

document_attachment  (new)
 ├── id
 ├── document_id     → document.id
 ├── file_url        VARCHAR(512) NOT NULL    -- Cloudinary URL
 ├── original_name   VARCHAR(255)
 ├── mime_type       VARCHAR(100)
 ├── size_bytes      BIGINT
 ├── uploaded_at     TIMESTAMP
 └── INDEX (document_id)

document_comment  (new — replaces space_post_comment for posts; space_post_comment table dropped after migration)
 ├── id
 ├── document_id     → document.id
 ├── author_id       → user.id
 ├── content         TEXT NOT NULL
 ├── created_at      TIMESTAMP
 └── INDEX (document_id, created_at)

mcp_api_token  (new)
 ├── id
 ├── user_id         → user.id
 ├── name            VARCHAR(100)   -- user-given label, e.g. "Claude Desktop home"
 ├── token_hash      VARCHAR(255) NOT NULL UNIQUE  -- SHA-256 of the raw token; raw shown to user exactly once
 ├── prefix          VARCHAR(8) NOT NULL  -- first 8 chars of raw token, shown in UI for identification
 ├── created_at      TIMESTAMP
 ├── last_used_at    TIMESTAMP NULL
 └── expired_at      TIMESTAMP NOT NULL  -- default created_at + 30 days, user-configurable

agent_conversation  (new)
 ├── id
 ├── user_id         → user.id
 ├── space_id        → space.id   -- conversations are scoped per (user, space)
 ├── title           VARCHAR(255) -- auto-generated from first user message (truncate ~80 chars)
 ├── created_at      TIMESTAMP
 ├── updated_at      TIMESTAMP
 └── INDEX (user_id, space_id, updated_at DESC)

agent_message  (new)
 ├── id
 ├── conversation_id → agent_conversation.id
 ├── role            ENUM('USER','ASSISTANT','TOOL') NOT NULL
 ├── content         JSON NOT NULL   -- text for USER/ASSISTANT, tool_use/tool_result blocks for TOOL turns
 ├── created_at      TIMESTAMP
 └── INDEX (conversation_id, created_at)

mcp_access_log  (new — retained 30 days, used for the "Recent activity" panel in §6.5)
 ├── id
 ├── token_id        → mcp_api_token.id
 ├── tool_name       VARCHAR(64)
 ├── called_at       TIMESTAMP
 ├── success         BOOLEAN
 └── INDEX (token_id, called_at DESC)

(tables dropped after migration)
 - journal_entry        → migrated into document
 - space_post           → migrated into document
 - space_post_comment   → migrated into document_comment
 - space_post_reaction  → DROPPED (reactions removed in pivot; see §10 Out-of-Scope)
```

### 3.2 Migration plan (Flyway)

This pivot **requires Phase 7's Flyway adoption to land first** (currently incomplete in roadmap). Migrations:

Migration is split into two release waves so DB tables are only dropped *after* application code stops referencing them:

```
Wave 1 — schema additions + data migration (deployed together with new code)

V2__add_document_model.sql
  - ALTER TABLE space MODIFY COLUMN invite_code VARCHAR(8) NULL
  - ALTER TABLE space ADD COLUMN is_personal BOOLEAN NOT NULL DEFAULT false
  - CREATE TABLE document, document_attachment, document_comment, mcp_api_token,
                 agent_conversation, agent_message, mcp_access_log
  - Backfill: for each user without a personal space, INSERT a row
              (is_personal=true, name='Personal', invite_code=NULL, owner_id=user.id)
              + matching space_member row (role=OWNER)
  - Backfill: INSERT INTO document SELECT FROM journal_entry
              (doc_type='JOURNAL', space_id=user's personal space, entry_date preserved,
               title=COALESCE(title, 'Untitled'), tags='[]')
  - Backfill: INSERT INTO document SELECT FROM space_post
              (doc_type='NOTE', space_id preserved, title=LEFT(content,80))
  - Backfill: INSERT INTO document_comment SELECT FROM space_post_comment
              (mapping old post_id → new document id via a temp map table created and dropped
               inside the migration)
  - Migrate image_paths / video_paths CSV columns from both journal_entry and space_post
    → individual rows in document_attachment
  - At end of wave 1, legacy tables (journal_entry, space_post, space_post_comment,
    space_post_reaction) remain in the DB but unread by the new code

V3__document_indexes.sql
  - FULLTEXT INDEX on document(title, content)
  - INDEX on document(space_id, doc_type, entry_date)
  - INDEX on document(author_id, created_at)

Wave 2 — legacy cleanup (deployed in a subsequent release, after wave 1 has been live
and verified for at least 1 week)

V4__drop_legacy_tables.sql
  - DROP TABLE journal_entry, space_post, space_post_comment, space_post_reaction
```

Each wave is rehearsed: dev → staging (production snapshot restore) → prod. Wave 1 must
include a tested rollback (V2 down migration restores old code's data view) before being
run on prod.

### 3.3 Personal Space invariants

- Auto-created on first login (or via migration backfill for existing users).
- `is_personal=true`, `invite_code=NULL`, exactly one OWNER member (= the user).
- Cannot be deleted, cannot be renamed via standard space-edit endpoint (separate `/api/profile/personal-space` rename if desired later).
- Other users cannot be invited (server-side block: reject `addMember` calls when `space.is_personal`).

---

## 4. The Unified Tool Set (8 tools)

These same Java method signatures back the REST API, the MCP adapter, and the internal agent. Defined as an interface `DocumentToolset`, implemented by `DocumentToolsetImpl` (delegating to `DocumentService`, `CommentService`, etc.). MCP adapter generates the MCP tool schema from this interface via reflection or hand-written mapping.

### 4.1 Read tools

```java
SearchResult searchDocuments(
    String query,              // required
    Long spaceId,              // optional: null = search all user-accessible spaces
    LocalDate dateFrom,        // optional
    LocalDate dateTo,          // optional
    List<String> tags,         // optional: AND match
    boolean rerank,            // default true: apply Haiku rerank pass on top-10 FULLTEXT hits
    int limit                  // default 10, max 25
)
// Returns: [{document_id, title, snippet, score, space_id, space_name, entry_date}]

DocumentDetail getDocument(Long id)
// Returns full document including content, tags, attachments[], top 20 comments.
// Access-checked: must be a member of doc.space_id.

List<SpaceSummary> listSpaces()
// Returns user's spaces with is_personal flag and member count.

PagedDocuments listDocuments(
    Long spaceId,              // optional
    DocType docType,           // optional: filter JOURNAL or NOTE
    LocalDateTime since,       // optional
    String tag,                // optional
    int limit, int offset
)

List<Comment> getComments(Long documentId)
```

### 4.2 Write tools

```java
DocumentDetail createDocument(
    String title,
    String content,
    Long spaceId,              // if null, defaults to caller's personal space
    DocType docType,           // default NOTE
    LocalDate entryDate,       // required iff docType=JOURNAL
    List<String> tags
)

DocumentDetail updateDocument(
    Long id,
    String title,              // optional
    String content,            // optional
    List<String> tags          // optional, replaces full list
)
// Author-only. Throws 403 if caller != author.

Comment addComment(Long documentId, String content)
// Any space member.
```

### 4.3 Tool design notes

- **The 8 tools are a deliberate subset of the full REST API.** The REST API used by the Web UI is a superset that additionally includes `deleteDocument`, `deleteComment`, multipart `uploadAttachment`, and `revokeMcpToken`. These are exposed only via REST (browser-only) and never to LLMs — see bullets below for why.
- **8 LLM-facing tools total.** Anthropic's docs recommend ≤ 12 for tool-use accuracy. We have headroom.
- **No `deleteDocument` / `deleteComment` in the LLM toolset.** Destructive actions stay UI-only to avoid accidental data loss from LLM-driven flows. (Can be added later if explicit confirmation patterns are designed.)
- **No `uploadAttachment` in the LLM toolset.** Attachments are uploaded via REST multipart from the Web UI only. For MVP, external MCP clients cannot upload files — only read existing attachments via URLs returned by `getDocument`. (Avoids the complexity of file transport over MCP. Stretch: add later via signed upload URLs.)
- **Search rerank flag.** Internal agent calls with `rerank=true` for quality. External MCP clients can choose; default `true`.
- **Space scoping in `searchDocuments`.** When called with `spaceId=null`, search runs across all spaces the authenticated user is a member of. Non-member spaces are never returned.
- **All tools enforce access control server-side via `@PreAuthorize` or service-layer membership check.** The MCP token authenticates a user; that user's space membership determines what they can see. The toolset never bypasses Spring Security.

---

## 5. Internal AI Agent (Web Chat)

### 5.1 UX

- On every Space Detail page (including Personal Space), a right-side chat panel toggled by an "Ask AI" button in the page top bar.
- Default scope: current space. A scope chip at the top of the chat shows "Searching: <Space name>" with a dropdown to switch to "All my spaces".
- Chat is **per-space + per-user** session; sessions persisted in DB so users can resume conversations.

### 5.2 Backend flow

```
POST /api/agent/chat
  body: { space_id, conversation_id?, message, attachments?: [url, ...] }

  → Load conversation history (last 20 messages, or start new)
  → Build system prompt with:
      "You are an assistant for the My Journey knowledge base.
       The user's current scope is space '<name>'.
       Use tools to find relevant documents. Always cite documents by ID in your answer."
  → Call Anthropic SDK with tools = the 8-tool schema, stream=true
  → Loop:
       - If response contains tool_use blocks: execute via DocumentToolset, append tool_result, re-call
       - If response is plain text: stream to client via SSE, persist final message
  → Hard limit: 10 tool calls per turn. If hit, return partial answer + warning.
```

### 5.3 Multimodal handling

- User pastes an image into chat: image is uploaded to Cloudinary, message includes a vision content block with the image URL → Haiku sees it.
- User asks "what does the PDF in this doc say?": Claude calls `getDocument`, sees attachment URL, then includes the PDF as an `input_document` content block in its next reasoning step (Anthropic SDK PDF input). Backend handles this by fetching the URL → base64 → including in the API call.
- Files other than image/PDF: `getDocument` still returns the attachment metadata, but agent will respond "I can see there's an attachment called `report.xlsx` but I can't read its contents directly."

### 5.4 Conversation persistence

```
agent_conversation
 ├── id, user_id, space_id, title (auto-generated from first message), created_at, updated_at

agent_message
 ├── id, conversation_id, role (USER|ASSISTANT|TOOL), content (JSON for tool calls/results, text otherwise), created_at
```

Conversations are scoped per (user_id, space_id). Listed in the chat panel as past sessions. Hard cap: 100 conversations per user per space (oldest pruned).

### 5.5 Rate limiting

Reuse existing Bucket4j setup. Add a new bucket:
- `/api/agent/chat`: 20 messages per user per hour
- This includes the cost of any tool calls the agent makes internally (each LLM turn = 1 bucket consumption)

---

## 6. MCP Server

### 6.1 Endpoint and transport

- Path: `/mcp` (Streamable HTTP transport per MCP 2025 spec)
- Implementation: `io.modelcontextprotocol:mcp-java-sdk` (Spring-maintained official SDK)
- Auth: `Authorization: Bearer mj_<token>` (token prefix `mj_` for identification in logs)

### 6.2 Tool exposure

All 8 tools from §4 are exposed verbatim. Tool descriptions are LLM-friendly (verbose, with usage examples in the JSON schema `description` field).

Example tool schema fragment:
```json
{
  "name": "search_documents",
  "description": "Search the user's knowledge base. Returns the top matching documents with snippets and document IDs. Use this when the user asks about something that might be in their notes or journal entries. After getting search results, call get_document to read the full content of relevant matches.",
  "input_schema": { ... }
}
```

### 6.3 User-facing setup

New page: **Profile → MCP Access**

UI flow:
1. User clicks "New API token"
2. Modal: name (e.g. "Claude Desktop on MacBook"), expiry (30/90/365 days)
3. Generated token shown **once** in a copy-able field with a "I've copied it" confirmation button
4. Token list shows: name, prefix (`mj_aBcDeFgH...`), created_at, last_used_at, expired_at, Revoke button
5. Below the list: a copy-pastable Claude Desktop config snippet

```json
{
  "mcpServers": {
    "my-journey": {
      "url": "https://myjourneycloud.com/mcp",
      "headers": { "Authorization": "Bearer mj_<your token here>" }
    }
  }
}
```

### 6.4 Rate limiting

- MCP endpoint: 60 req / min / token (more than Web because external agents do more tool calls per user-prompt)
- 1000 req / day / user (across all tokens) — soft cap, return 429 with `Retry-After`

### 6.5 Security

- Token storage: store SHA-256(token) — not plaintext, not bcrypt (we don't need slow hashing here because tokens have high entropy; SHA-256 is fine and faster on lookup).
- `last_used_at` updated on each call (async, fire-and-forget to avoid latency).
- Auto-expire: scheduled job daily marks `expired_at < now` tokens as soft-deleted.
- Audit log table `mcp_access_log(token_id, tool_name, called_at, success)` — last 30 days kept for user inspection on the MCP Access page ("Recent activity").
- No CORS on `/mcp` (it's not browser-facing).

---

## 7. Frontend Surface

New / changed pages in the React app:

| Page | Status | Notes |
|------|--------|-------|
| `/spaces/:id` | **redesigned** | Document list (with type/tag filters) replaces post timeline. Each doc opens a doc detail view. |
| `/spaces/:id/documents/:docId` | **new** | Doc detail: markdown render, attachments, comments thread, edit button (author-only). |
| `/spaces/:id/documents/:docId/edit` | **new** | Markdown editor + tag input + attachment uploader. Saved via REST PUT. |
| `/journal` (existing) | **redesigned** | Filtered view of `doc_type=JOURNAL` in user's personal space. Calendar view preserved. |
| `/journal/:id` | **redesigned** | Doc detail view scoped to JOURNAL type (same component as space doc detail with mode flag). |
| `/journal/new` | **redesigned** | Same editor as doc editor, with `entry_date` field shown. |
| `/profile/mcp` | **new** | API token management (see §6.3). |
| Agent chat panel | **new** | Right-side panel component on space detail pages. |

Out of scope for this spec (kept as-is): Landing, Auth pages, Dashboard, Notifications, Privacy/Terms.

### 7.1 Markdown editor choice

**Recommendation: `@uiw/react-md-editor` with attachment plugin** OR plain `<textarea>` + `react-markdown` preview, decided during implementation. Both meet requirements:
- Markdown syntax (CommonMark + tables + checkboxes)
- Live preview (split or toggle)
- File drag-and-drop for attachments (with Cloudinary upload progress)
- Light + dark mode via tokens.css variables

`@uiw/react-md-editor` adds ~80kb gzipped; acceptable. Falls back to vanilla textarea + preview if bundle size or UX is unsatisfactory.

### 7.2 Tag input

Free-text tags, normalized lowercase, comma-separated input. Autocomplete from previously-used tags in the current space (one query on focus). No taxonomy, no validation.

---

## 8. Roadmap Positioning

This pivot **replaces Phase 8** ("Smart Journaling") in `docs/roadmap.md`. Phase 7 (Production Hardening) remains a prerequisite — backups, Flyway, Sentry, UptimeRobot must be in place before this work starts. Phase 9 (Deferred) is unchanged; embeddings / Qdrant / orchestrator / encryption-at-rest remain deferred until real usage signals demand them.

The deferred items below have been intentionally cut from this pivot (see §10):

- Mood selector, streak counter, daily writing reminders → not aligned with the team-KB story; revisit if user feedback requests them.
- Weekly pattern recap, On This Day → can be re-added as scheduled jobs that create `Document` rows in personal space. Not in the MVP.

---

## 9. Phasing (sub-projects in implementation order)

This spec is large; the implementation plan (next step, written via the writing-plans skill) will decompose into sub-projects roughly along these boundaries. **No timeline committed here** — the spec captures *what*, the plan captures *how/order*.

1. **Phase 7 closure** — Flyway baseline + remaining hardening items (prerequisite, already in roadmap)
2. **Document model migration** — V2/V3 migrations, Document/Comment/Attachment entities and CRUD, drop legacy tables
3. **Frontend doc UI** — doc list / detail / editor in spaces + journal redesign on top of new data model
4. **Internal AI agent** — toolset interface, agent service, chat panel, conversation persistence
5. **MCP server** — adapter, token management, profile UI, audit log
6. **Polish + docs** — landing page update, README "MCP setup" guide, demo video for portfolio

Each sub-project lands as its own PR, integration-tested before the next begins.

---

## 10. Out of Scope (explicitly deferred)

| Item | Why deferred | When to revisit |
|------|-------------|-----------------|
| Real-time collaborative editing (Yjs/CRDT) | 2-3 month standalone project; not core to the B+C story | Only if multi-user simultaneous edit demand emerges |
| Document version history | Adds revision table + diff UI; valuable but not MVP | Phase 11 once core is shipped |
| Reactions on documents | Aligns with social, not KB. Removing `space_post_reaction` is part of this pivot. | If user feedback explicitly asks |
| Embeddings / vector search / Qdrant | Still constrained by 2GB VPS; FULLTEXT + Haiku rerank handles current scale | Per Phase 9 signals in roadmap |
| Voice input / Whisper / audio attachments | Story relevance weak; resource-heavy | Phase 9 if requested |
| File upload via MCP | Complex transport, security audit needed | Stretch once MCP is stable |
| Custom agent orchestrator | Tool-use loop handles all current cases | Per Phase 9 signals |
| Document permissions beyond "author edit / member read" | YAGNI for small teams | If/when paid tier emerges |
| Mood / tag / streak / writing reminders (original Phase 8) | Off-narrative for team KB story | Tags are kept (per-doc); other items dropped unless requested |
| Mobile native app | PWA suffices | Per Phase 9 signals |

---

## 11. Success Criteria

A reasonable observer reviewing the deployed product and codebase should be able to confirm:

1. A user can sign up, see their auto-created Personal Space, write a markdown document with an attached image and a PDF, and search it.
2. A user can create a Space, invite a teammate, and both can author documents and comment on each other's docs.
3. From the Web UI, the user can ask the AI agent "what did we decide about onboarding last week?" and get an answer with citations to specific documents.
4. The user can generate an MCP API token, paste it into Claude Desktop's config, and from Claude Desktop ask the same question across the same data — getting an equivalent answer.
5. From Claude Desktop, the user can dictate a new document into their Personal Space; refreshing the Web UI shows it.
6. The deployed system runs on the existing 2GB DigitalOcean VPS with the new components active, with memory and CPU headroom comparable to the pre-pivot baseline.
7. Existing journal entries and space posts from the production DB are present and intact as Documents after migration.

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Data loss during journal_entry → document migration | Rehearse on production DB snapshot; require Flyway + tested rollback before prod run; backup before migration runs |
| MCP tool calls consume tokens unboundedly under abuse | Hard rate limits + daily caps + per-tool-call audit log |
| AI agent hallucinates citations | Post-process: agent must include doc IDs; reject answers that cite nonexistent IDs (regenerate with explicit warning) |
| 2GB VPS memory pressure from added entities | Spring Boot footprint is unchanged (no new processes); monitor via Sentry; embeddings remain deferred |
| Markdown editor breaks Apple HIG visual consistency | Style overrides via tokens.css; if `@uiw` looks foreign, fall back to plain textarea + preview |
| Claude Desktop config UX is unfamiliar to non-devs | Profile → MCP Access page provides copy-pastable JSON; link to a short setup guide in README |
| Anthropic PDF input cost spikes | Cache: if same PDF already passed in same conversation, reference by previous turn rather than re-uploading |
| External MCP client uploads attachments via base64 → memory spike | MVP disallows uploads via MCP entirely (read-only attachments). Stretch revisits with signed URLs. |

---

## 13. Open Questions (to address during implementation plan)

- Exact Anthropic SDK version pinning given current Spring Boot 3.4.5 / Java 21 baseline
- Whether the agent chat panel should be a full-page route on mobile (< 640px) instead of a side panel
- Conversation export — out of scope for MVP, but worth flagging during plan
- Whether to migrate existing `space_post_reaction` data to comments ("X reacted ❤️" auto-comments) or simply drop — currently spec says drop, revisit during plan if data volume is significant

---

**End of design.** Next step (after user review): invoke the writing-plans skill to produce an implementation plan with concrete task ordering and acceptance criteria per sub-project.
