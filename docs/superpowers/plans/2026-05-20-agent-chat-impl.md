# Internal AI Agent (Web Chat) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the internal AI agent chat described in `docs/superpowers/specs/2026-05-19-team-kb-mcp-design.md` §4–§5: a Claude Haiku 4.5 tool-use loop that lets a user, from inside a Space, ask natural-language questions over their documents and get answers with citations. The same toolset is later re-exposed via MCP (out of scope for this plan).

**Architecture:** New `DocumentToolset` interface implemented by `DocumentToolsetImpl` (delegating to existing `DocumentService` / `SpaceService` / `CommentService`). `AgentService` runs the tool-use loop against Claude Haiku 4.5 via `RestTemplate` (same pattern as `AiService`), persisting each turn (USER / ASSISTANT / TOOL) into new `agent_conversation` / `agent_message` tables. `AgentChatController` streams assistant text via `SseEmitter`. Frontend mounts a `ChatPanel` (right-drawer on desktop, full-page route on mobile) on `SpaceDetailPage`.

**Tech Stack:** Spring Boot 3.4.5, Java 21, Spring MVC `SseEmitter`, JPA, Flyway, Bucket4j (existing in-memory rate limit), Anthropic HTTP API (`claude-haiku-4-5-20251001`), React 18 + Vite + TS, Tailwind v4, tokens.css.

**Scope explicitly NOT in this plan:**
- MCP server / API tokens — separate plan (sub-project 5 in spec §9).
- Embeddings / vector search / rerank pass — spec §10 defers.
- Attachment upload via the agent — UI-only (spec §4.3).
- Adding a frontend test framework — none exists today; this plan uses manual smoke tests on the React side.

---

## File Structure

**Backend — new files:**
- `src/main/resources/db/migration/V7__add_agent_tables.sql` — schema for conversations + messages
- `src/main/java/com/myjourney/model/AgentConversation.java` — entity
- `src/main/java/com/myjourney/model/AgentMessage.java` — entity (role + JSON content)
- `src/main/java/com/myjourney/repository/AgentConversationRepository.java`
- `src/main/java/com/myjourney/repository/AgentMessageRepository.java`
- `src/main/java/com/myjourney/agent/DocumentToolset.java` — toolset interface (8 read+write methods)
- `src/main/java/com/myjourney/agent/DocumentToolsetImpl.java` — delegates to services
- `src/main/java/com/myjourney/agent/ToolSchemas.java` — Anthropic JSON schema for each tool, hand-written
- `src/main/java/com/myjourney/agent/AnthropicChatClient.java` — RestTemplate wrapper for messages API (chat + tool-use)
- `src/main/java/com/myjourney/agent/AgentService.java` — tool-use loop + persistence
- `src/main/java/com/myjourney/controller/AgentChatController.java` — POST chat (SSE), list conversations, get messages
- `src/main/java/com/myjourney/dto/agent/*.java` — request/response DTOs

**Backend — modified files:**
- `src/main/java/com/myjourney/filter/RateLimitFilter.java` — add `/api/agent/chat` bucket
- `src/main/java/com/myjourney/service/DocumentService.java` — add `searchAccessibleDocuments` (cross-space search; the toolset needs this when `spaceId=null`)

**Backend — tests (Java):**
- `src/test/java/com/myjourney/agent/DocumentToolsetImplTest.java`
- `src/test/java/com/myjourney/agent/AgentServiceTest.java` (mocks `AnthropicChatClient` + `DocumentToolset`)
- `src/test/java/com/myjourney/controller/AgentChatControllerTest.java` (MockMvc)

**Frontend — new files:**
- `frontend/src/api/agent.ts` — typed wrappers + SSE streaming helper
- `frontend/src/pages/agent/ChatPanel.tsx` — drawer/page component (the chat UI)
- `frontend/src/pages/agent/ChatPanel.css`
- `frontend/src/pages/agent/AgentChatPage.tsx` — mobile full-page wrapper around `ChatPanel`
- `frontend/src/types/agent.ts` — TS types matching backend DTOs

**Frontend — modified files:**
- `frontend/src/App.tsx` — add `/spaces/:id/chat` mobile route
- `frontend/src/pages/spaces/SpaceDetailPage.tsx` — "Ask AI" button in `PageTopBar` actions
- `frontend/src/types/api.ts` — add `DocType` export if missing (already exists)

---

## Section A — Database + Entities + Repositories

### Task A1: V7 migration for agent tables

**Files:**
- Create: `src/main/resources/db/migration/V7__add_agent_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- V7__add_agent_tables.sql
-- Internal AI Agent (web chat) — see docs/superpowers/specs/2026-05-19-team-kb-mcp-design.md §5.4.
-- Conversations are scoped per (user, space). agent_message stores the verbatim
-- turn record; for ASSISTANT/USER turns content is a JSON {"text": "..."}, and
-- for TOOL turns content is the JSON tool_use / tool_result block array.

CREATE TABLE agent_conversation (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     INT          NOT NULL,
    space_id    INT          NOT NULL,
    title       VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    created_at  TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_agent_conv_user  FOREIGN KEY (user_id)  REFERENCES `user`(id)  ON DELETE CASCADE,
    CONSTRAINT fk_agent_conv_space FOREIGN KEY (space_id) REFERENCES `space`(id) ON DELETE CASCADE,
    INDEX idx_agent_conv_user_space_updated (user_id, space_id, updated_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE agent_message (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT       NOT NULL,
    role            VARCHAR(16)  NOT NULL,             -- 'USER' | 'ASSISTANT' | 'TOOL'
    content         JSON         NOT NULL,
    created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_agent_msg_conv FOREIGN KEY (conversation_id) REFERENCES agent_conversation(id) ON DELETE CASCADE,
    INDEX idx_agent_msg_conv_created (conversation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

- [ ] **Step 2: Verify locally**

Run: `./mvnw flyway:info`
Expected: `V7` listed as `Pending`.

Run: `./mvnw flyway:migrate`
Expected: `Successfully applied 1 migration to schema "my_journey", now at version v7`.

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/db/migration/V7__add_agent_tables.sql
git commit -m "Add V7 migration for agent_conversation + agent_message"
```

---

### Task A2: AgentConversation entity + repository

**Files:**
- Create: `src/main/java/com/myjourney/model/AgentConversation.java`
- Create: `src/main/java/com/myjourney/repository/AgentConversationRepository.java`

- [ ] **Step 1: Write the entity**

```java
package com.myjourney.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "agent_conversation")
public class AgentConversation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "space_id", nullable = false)
    private Space space;

    @Column(nullable = false, length = 255)
    private String title = "Untitled";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Space getSpace() { return space; }
    public void setSpace(Space space) { this.space = space; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
```

- [ ] **Step 2: Write the repository**

```java
package com.myjourney.repository;

import com.myjourney.model.AgentConversation;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AgentConversationRepository extends JpaRepository<AgentConversation, Long> {
    List<AgentConversation> findByUserAndSpaceOrderByUpdatedAtDesc(User user, Space space);
    long countByUserAndSpace(User user, Space space);
}
```

- [ ] **Step 3: Compile**

Run: `./mvnw compile -q`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/myjourney/model/AgentConversation.java \
        src/main/java/com/myjourney/repository/AgentConversationRepository.java
git commit -m "Add AgentConversation entity + repository"
```

---

### Task A3: AgentMessage entity + repository

**Files:**
- Create: `src/main/java/com/myjourney/model/AgentMessage.java`
- Create: `src/main/java/com/myjourney/repository/AgentMessageRepository.java`

- [ ] **Step 1: Write the entity**

```java
package com.myjourney.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "agent_message")
public class AgentMessage {

    public enum Role { USER, ASSISTANT, TOOL }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private AgentConversation conversation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role;

    // USER/ASSISTANT: { "text": "..." }
    // TOOL: array of tool_use or tool_result blocks (Anthropic content block shape)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "JSON")
    private JsonNode content;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public Long getId() { return id; }
    public AgentConversation getConversation() { return conversation; }
    public void setConversation(AgentConversation c) { this.conversation = c; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public JsonNode getContent() { return content; }
    public void setContent(JsonNode content) { this.content = content; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 2: Write the repository**

```java
package com.myjourney.repository;

import com.myjourney.model.AgentConversation;
import com.myjourney.model.AgentMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AgentMessageRepository extends JpaRepository<AgentMessage, Long> {
    List<AgentMessage> findByConversationOrderByCreatedAtAsc(AgentConversation conversation);
    long countByConversation(AgentConversation conversation);
}
```

- [ ] **Step 3: Compile**

Run: `./mvnw compile -q`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/myjourney/model/AgentMessage.java \
        src/main/java/com/myjourney/repository/AgentMessageRepository.java
git commit -m "Add AgentMessage entity + repository"
```

---

## Section B — DocumentToolset Interface + Cross-Space Search

The toolset is the 8 tools from spec §4. We extract them as an interface so the same surface can be re-exposed via MCP in the next sub-project. Each tool returns plain DTOs (no JPA entities) so MCP serialization stays trivial.

### Task B1: Toolset DTOs

**Files:**
- Create: `src/main/java/com/myjourney/agent/dto/ToolSearchResult.java`
- Create: `src/main/java/com/myjourney/agent/dto/ToolDocumentDetail.java`
- Create: `src/main/java/com/myjourney/agent/dto/ToolSpaceSummary.java`
- Create: `src/main/java/com/myjourney/agent/dto/ToolComment.java`

- [ ] **Step 1: Write the DTOs as records**

```java
// ToolSearchResult.java
package com.myjourney.agent.dto;
import java.time.LocalDate;
import java.util.List;
public record ToolSearchResult(List<Hit> hits) {
    public record Hit(
            Long documentId,
            String title,
            String snippet,
            Integer spaceId,
            String spaceName,
            LocalDate entryDate,
            String docType
    ) {}
}
```

```java
// ToolDocumentDetail.java
package com.myjourney.agent.dto;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
public record ToolDocumentDetail(
        Long id,
        String title,
        String content,
        String docType,
        LocalDate entryDate,
        List<String> tags,
        Integer spaceId,
        String spaceName,
        String authorUsername,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<Attachment> attachments,
        List<ToolComment> recentComments
) {
    public record Attachment(String url, String originalName, String mimeType, Long sizeBytes) {}
}
```

```java
// ToolSpaceSummary.java
package com.myjourney.agent.dto;
public record ToolSpaceSummary(
        Integer id,
        String name,
        boolean isPersonal,
        long memberCount
) {}
```

```java
// ToolComment.java
package com.myjourney.agent.dto;
import java.time.LocalDateTime;
public record ToolComment(
        Long id,
        String content,
        String authorUsername,
        LocalDateTime createdAt
) {}
```

- [ ] **Step 2: Compile**

Run: `./mvnw compile -q`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/agent/dto/
git commit -m "Add agent toolset DTOs"
```

---

### Task B2: DocumentToolset interface

**Files:**
- Create: `src/main/java/com/myjourney/agent/DocumentToolset.java`

- [ ] **Step 1: Write the interface**

```java
package com.myjourney.agent;

import com.myjourney.agent.dto.*;
import java.time.LocalDate;
import java.util.List;

// The 8 tools the internal agent (and later the MCP server) can call.
// All methods are access-checked against the authenticated user — the
// implementation MUST refuse access to spaces the user is not a member of.
public interface DocumentToolset {

    // ── Read tools ────────────────────────────────────────

    ToolSearchResult searchDocuments(
            Integer callerUserId,
            String query,
            Integer spaceId,           // null = search every space the caller is in
            LocalDate dateFrom,        // optional
            LocalDate dateTo,          // optional
            List<String> tags,         // AND match (lowercase); null = no tag filter
            int limit                  // capped to 25
    );

    ToolDocumentDetail getDocument(Integer callerUserId, Long documentId);

    List<ToolSpaceSummary> listSpaces(Integer callerUserId);

    ToolSearchResult listDocuments(
            Integer callerUserId,
            Integer spaceId,           // required
            String docType,            // "JOURNAL" | "NOTE" | null
            LocalDate since,           // by created_at; optional
            String tag,                // optional single tag (lowercase)
            int limit,
            int offset
    );

    List<ToolComment> getComments(Integer callerUserId, Long documentId);

    // ── Write tools ───────────────────────────────────────

    ToolDocumentDetail createDocument(
            Integer callerUserId,
            String title,
            String content,
            Integer spaceId,           // null → caller's personal space
            String docType,            // default NOTE
            LocalDate entryDate,       // required iff docType=JOURNAL
            List<String> tags
    );

    ToolDocumentDetail updateDocument(
            Integer callerUserId,
            Long documentId,
            String title,              // optional (null = unchanged)
            String content,            // optional
            List<String> tags          // optional (null = unchanged; empty list = clear)
    );

    ToolComment addComment(Integer callerUserId, Long documentId, String content);
}
```

- [ ] **Step 2: Compile**

Run: `./mvnw compile -q`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/agent/DocumentToolset.java
git commit -m "Add DocumentToolset interface (8 agent tools)"
```

---

### Task B3: Cross-space search helper in DocumentService

The current `searchDocumentsInSpace` requires a space ID. The toolset's `searchDocuments` allows `spaceId=null` (search every space the caller is a member of). Add the cross-space method now so the toolset impl can delegate.

**Files:**
- Modify: `src/main/java/com/myjourney/service/DocumentService.java`
- Modify: `src/main/java/com/myjourney/repository/DocumentRepository.java`
- Test: `src/test/java/com/myjourney/service/DocumentServiceCrossSpaceSearchTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.myjourney.service;

import com.myjourney.model.Document;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import com.myjourney.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class DocumentServiceCrossSpaceSearchTest {

    @Autowired DocumentService documentService;
    @Autowired UserRepository userRepository;
    @Autowired SpaceRepository spaceRepository;
    @Autowired SpaceMemberRepository spaceMemberRepository;
    @Autowired DocumentRepository documentRepository;

    @Test
    void searchAccessibleDocuments_onlyReturnsHitsFromSpacesUserIsMemberOf() {
        // Two users, two spaces. user1 is a member of space1 only.
        // Both spaces have a doc whose title contains "alpha".
        // user1's search must return only the space1 doc.
        TestDataFixture f = TestDataFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);

        List<Document> hits = documentService.searchAccessibleDocuments(
                f.user1.getId(), "alpha", null, null, null, 25);

        assertThat(hits).hasSize(1);
        assertThat(hits.get(0).getSpace().getId()).isEqualTo(f.space1.getId());
    }
}
```

Note: `TestDataFixture.createTwoUsersTwoSpacesAlpha` will be created in Step 2.

- [ ] **Step 2: Write the test fixture helper**

Create: `src/test/java/com/myjourney/service/TestDataFixture.java`

```java
package com.myjourney.service;

import com.myjourney.model.Document;
import com.myjourney.model.Space;
import com.myjourney.model.SpaceMember;
import com.myjourney.model.User;
import com.myjourney.repository.*;

import java.time.LocalDate;
import java.util.ArrayList;

class TestDataFixture {

    User user1;
    User user2;
    Space space1;
    Space space2;

    static TestDataFixture createTwoUsersTwoSpacesAlpha(
            UserRepository userRepo,
            SpaceRepository spaceRepo,
            SpaceMemberRepository memberRepo,
            DocumentRepository docRepo) {
        TestDataFixture f = new TestDataFixture();
        f.user1 = newUser(userRepo, "alice");
        f.user2 = newUser(userRepo, "bob");
        f.space1 = newSpace(spaceRepo, f.user1, "space1");
        f.space2 = newSpace(spaceRepo, f.user2, "space2");
        addOwnerMember(memberRepo, f.space1, f.user1);
        addOwnerMember(memberRepo, f.space2, f.user2);
        newDoc(docRepo, f.space1, f.user1, "alpha doc in s1");
        newDoc(docRepo, f.space2, f.user2, "alpha doc in s2");
        return f;
    }

    private static User newUser(UserRepository r, String username) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(username + "@example.com");
        u.setPassword("x");
        return r.save(u);
    }

    private static Space newSpace(SpaceRepository r, User owner, String name) {
        Space s = new Space();
        s.setName(name);
        s.setOwner(owner);
        s.setInviteCode(name + "1234");
        s.setPersonal(false);
        return r.save(s);
    }

    private static void addOwnerMember(SpaceMemberRepository r, Space s, User u) {
        SpaceMember m = new SpaceMember();
        m.setSpace(s);
        m.setUser(u);
        m.setRole("OWNER");
        r.save(m);
    }

    private static Document newDoc(DocumentRepository r, Space s, User author, String title) {
        Document d = new Document();
        d.setSpace(s);
        d.setAuthor(author);
        d.setTitle(title);
        d.setContent("body");
        d.setDocType(Document.DocType.NOTE);
        d.setTags(new ArrayList<>());
        return r.save(d);
    }
}
```

Note: adjust `setRole("OWNER")` / column names to match the actual `User`, `Space`, `SpaceMember` API (the engineer must read the current entity classes before pasting). If the existing User entity requires more required fields (e.g., `provider`), set them too — the goal is to produce a savable entity.

- [ ] **Step 3: Run test to verify it fails**

Run: `./mvnw test -Dtest=DocumentServiceCrossSpaceSearchTest`
Expected: FAIL with `searchAccessibleDocuments` method not found on DocumentService.

- [ ] **Step 4: Add the repository query**

Append to `src/main/java/com/myjourney/repository/DocumentRepository.java` (inside the interface body, before the closing `}`):

```java
    @Query("""
        SELECT d FROM Document d
        WHERE d.space.id IN :spaceIds
          AND (LOWER(d.title)   LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(d.content) LIKE LOWER(CONCAT('%', :keyword, '%')))
          AND (:from IS NULL OR d.entryDate >= :from)
          AND (:to   IS NULL OR d.entryDate <= :to)
        ORDER BY
            CASE WHEN d.docType = com.myjourney.model.Document.DocType.JOURNAL
                 THEN d.entryDate END DESC,
            d.createdAt DESC
        """)
    List<Document> searchAcrossSpaces(
            @Param("spaceIds") List<Integer> spaceIds,
            @Param("keyword") String keyword,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            Pageable pageable);
```

Imports to add at the top of the file: `import org.springframework.data.domain.Pageable;`.

- [ ] **Step 5: Implement `searchAccessibleDocuments` in DocumentService**

Append to `DocumentService.java`, in the "Search" section:

```java
    // Cross-space keyword search used by the agent toolset's searchDocuments
    // when spaceId is null. Restricted to spaces the caller is a member of.
    // Tag filtering is applied in-memory because tags live in a JSON column;
    // result set is already capped to `limit` rows so the post-filter is cheap.
    public List<Document> searchAccessibleDocuments(
            Integer userId,
            String keyword,
            LocalDate from,
            LocalDate to,
            List<String> tagsAndMatch,
            int limit) {
        User user = loadUser(userId);
        List<Integer> spaceIds = spaceMemberRepository.findSpaceIdsByUser(user);
        if (spaceIds.isEmpty()) return List.of();
        String kw = keyword == null ? "" : keyword.trim();
        if (kw.isEmpty()) return List.of();

        int capped = Math.min(Math.max(limit, 1), 25);
        List<Document> hits = documentRepository.searchAcrossSpaces(
                spaceIds, kw, from, to, PageRequest.of(0, capped));

        if (tagsAndMatch == null || tagsAndMatch.isEmpty()) return hits;
        List<String> normalized = tagsAndMatch.stream()
                .filter(t -> t != null && !t.isBlank())
                .map(t -> t.trim().toLowerCase(Locale.ROOT))
                .toList();
        return hits.stream()
                .filter(d -> d.getTags() != null && d.getTags().containsAll(normalized))
                .toList();
    }
```

- [ ] **Step 6: Add the repository method `findSpaceIdsByUser`**

Append to `src/main/java/com/myjourney/repository/SpaceMemberRepository.java`:

```java
    @Query("SELECT m.space.id FROM SpaceMember m WHERE m.user = :user")
    List<Integer> findSpaceIdsByUser(@Param("user") User user);
```

Add the required imports if missing (`org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param`, `com.myjourney.model.User`, `java.util.List`).

- [ ] **Step 7: Run test to verify it passes**

Run: `./mvnw test -Dtest=DocumentServiceCrossSpaceSearchTest`
Expected: PASS (1 test).

- [ ] **Step 8: Commit**

```bash
git add src/main/java/com/myjourney/repository/DocumentRepository.java \
        src/main/java/com/myjourney/repository/SpaceMemberRepository.java \
        src/main/java/com/myjourney/service/DocumentService.java \
        src/test/java/com/myjourney/service/DocumentServiceCrossSpaceSearchTest.java \
        src/test/java/com/myjourney/service/TestDataFixture.java
git commit -m "Add cross-space document search for agent toolset"
```

---

### Task B4: DocumentToolsetImpl

**Files:**
- Create: `src/main/java/com/myjourney/agent/DocumentToolsetImpl.java`
- Test: `src/test/java/com/myjourney/agent/DocumentToolsetImplTest.java`

- [ ] **Step 1: Write the failing test (one happy-path per tool method)**

```java
package com.myjourney.agent;

import com.myjourney.agent.dto.*;
import com.myjourney.model.*;
import com.myjourney.repository.*;
import com.myjourney.service.TestDataFixture;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class DocumentToolsetImplTest {

    @Autowired DocumentToolset toolset;
    @Autowired UserRepository userRepository;
    @Autowired SpaceRepository spaceRepository;
    @Autowired SpaceMemberRepository spaceMemberRepository;
    @Autowired DocumentRepository documentRepository;

    @Test
    void searchDocuments_returnsHitsForMembersOnly() {
        TestDataFixture f = TestDataFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);

        ToolSearchResult r = toolset.searchDocuments(
                f.user1.getId(), "alpha", null, null, null, null, 25);

        assertThat(r.hits()).hasSize(1);
        assertThat(r.hits().get(0).spaceId()).isEqualTo(f.space1.getId());
        assertThat(r.hits().get(0).title()).contains("alpha");
    }

    @Test
    void getDocument_returnsDetailForMember() {
        TestDataFixture f = TestDataFixture.createTwoUsersTwoSpacesAlpha(
                userRepository, spaceRepository, spaceMemberRepository, documentRepository);
        Long docId = documentRepository.findAll().stream()
                .filter(d -> d.getSpace().getId().equals(f.space1.getId()))
                .findFirst().orElseThrow().getId();

        ToolDocumentDetail d = toolset.getDocument(f.user1.getId(), docId);

        assertThat(d.id()).isEqualTo(docId);
        assertThat(d.spaceId()).isEqualTo(f.space1.getId());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./mvnw test -Dtest=DocumentToolsetImplTest`
Expected: FAIL — no bean of type `DocumentToolset` found.

- [ ] **Step 3: Implement DocumentToolsetImpl**

```java
package com.myjourney.agent;

import com.myjourney.agent.dto.*;
import com.myjourney.exception.AppException;
import com.myjourney.model.Document;
import com.myjourney.model.DocumentComment;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.DocumentService;
import com.myjourney.service.SpaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

// Bridges the agent's 8-tool surface to the existing service layer. Holds no
// business logic of its own — all access checks, validation, and persistence
// happen inside DocumentService / SpaceService.
@Service
public class DocumentToolsetImpl implements DocumentToolset {

    private static final int SNIPPET_MAX = 200;

    @Autowired private DocumentService documentService;
    @Autowired private SpaceService spaceService;
    @Autowired private UserRepository userRepository;
    @Autowired private SpaceRepository spaceRepository;
    @Autowired private SpaceMemberRepository spaceMemberRepository;

    @Override
    public ToolSearchResult searchDocuments(Integer userId, String query, Integer spaceId,
                                            LocalDate from, LocalDate to,
                                            List<String> tags, int limit) {
        int capped = Math.min(Math.max(limit, 1), 25);
        List<Document> docs;
        if (spaceId == null) {
            docs = documentService.searchAccessibleDocuments(userId, query, from, to, tags, capped);
        } else {
            // Same path as the keyword-search endpoint (JOURNAL or NOTE — toolset
            // doesn't carry a doc-type filter, so pass NOTE then JOURNAL and merge).
            Page<Document> note    = documentService.searchDocumentsInSpace(
                    userId, spaceId, Document.DocType.NOTE,    query, null, 0, capped);
            Page<Document> journal = documentService.searchDocumentsInSpace(
                    userId, spaceId, Document.DocType.JOURNAL, query, null, 0, capped);
            docs = java.util.stream.Stream.concat(
                    note.getContent().stream(), journal.getContent().stream())
                    .limit(capped).toList();
        }
        List<ToolSearchResult.Hit> hits = docs.stream().map(this::toHit).toList();
        return new ToolSearchResult(hits);
    }

    @Override
    public ToolDocumentDetail getDocument(Integer userId, Long documentId) {
        Document d = documentService.getDocumentForUser(userId, documentId);
        var atts = documentService.getAttachments(documentId).stream()
                .map(a -> new ToolDocumentDetail.Attachment(
                        a.getFileUrl(), a.getOriginalName(), a.getMimeType(), a.getSizeBytes()))
                .toList();
        var comments = documentService.getComments(documentId).stream()
                .limit(20)
                .map(this::toComment)
                .toList();
        return new ToolDocumentDetail(
                d.getId(), d.getTitle(), d.getContent(), d.getDocType().name(),
                d.getEntryDate(), d.getTags(), d.getSpace().getId(), d.getSpace().getName(),
                d.getAuthor().getUsername(), d.getCreatedAt(), d.getUpdatedAt(),
                atts, comments);
    }

    @Override
    public List<ToolSpaceSummary> listSpaces(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
        return spaceMemberRepository.findSpaceIdsByUser(user).stream()
                .map(id -> spaceRepository.findById(id).orElse(null))
                .filter(java.util.Objects::nonNull)
                .map(s -> new ToolSpaceSummary(
                        s.getId(), s.getName(), s.isPersonal(),
                        spaceMemberRepository.countBySpace(s)))
                .toList();
    }

    @Override
    public ToolSearchResult listDocuments(Integer userId, Integer spaceId, String docType,
                                          LocalDate since, String tag, int limit, int offset) {
        int capped = Math.min(Math.max(limit, 1), 25);
        Document.DocType type = parseDocType(docType);
        Page<Document> p = documentService.listDocumentsInSpace(
                userId, spaceId, type, null, offset / capped, capped);
        var hits = p.getContent().stream()
                .filter(d -> since == null
                        || (d.getEntryDate() != null && !d.getEntryDate().isBefore(since)))
                .filter(d -> tag == null || (d.getTags() != null && d.getTags().contains(tag.toLowerCase())))
                .map(this::toHit)
                .toList();
        return new ToolSearchResult(hits);
    }

    @Override
    public List<ToolComment> getComments(Integer userId, Long documentId) {
        documentService.getDocumentForUser(userId, documentId); // access check
        return documentService.getComments(documentId).stream()
                .map(this::toComment).toList();
    }

    @Override
    public ToolDocumentDetail createDocument(Integer userId, String title, String content,
                                              Integer spaceId, String docType,
                                              LocalDate entryDate, List<String> tags) {
        Integer effectiveSpaceId = spaceId != null ? spaceId : spaceService.findPersonalSpaceId(userId);
        Document.DocType type = parseDocType(docType);
        if (type == null) type = Document.DocType.NOTE;
        Document d = documentService.createDocument(
                userId, effectiveSpaceId, title, content, type, entryDate, tags);
        return getDocument(userId, d.getId());
    }

    @Override
    public ToolDocumentDetail updateDocument(Integer userId, Long documentId, String title,
                                              String content, List<String> tags) {
        Document d = documentService.updateDocument(userId, documentId, title, content, tags);
        return getDocument(userId, d.getId());
    }

    @Override
    public ToolComment addComment(Integer userId, Long documentId, String content) {
        DocumentComment c = documentService.addComment(userId, documentId, content);
        return toComment(c);
    }

    // ── Mapping helpers ───────────────────────────────────

    private ToolSearchResult.Hit toHit(Document d) {
        String body = d.getContent() == null ? "" : d.getContent();
        String snippet = body.length() > SNIPPET_MAX ? body.substring(0, SNIPPET_MAX) : body;
        return new ToolSearchResult.Hit(
                d.getId(), d.getTitle(), snippet,
                d.getSpace().getId(), d.getSpace().getName(),
                d.getEntryDate(), d.getDocType().name());
    }

    private ToolComment toComment(DocumentComment c) {
        return new ToolComment(
                c.getId(), c.getContent(),
                c.getAuthor().getUsername(), c.getCreatedAt());
    }

    private Document.DocType parseDocType(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Document.DocType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException(HttpStatus.BAD_REQUEST,
                    "Unknown docType '" + raw + "'. Expected JOURNAL or NOTE.");
        }
    }
}
```

- [ ] **Step 4: Add `SpaceService.findPersonalSpaceId`**

Open `src/main/java/com/myjourney/service/SpaceService.java`. Add (or confirm an equivalent already exists):

```java
    public Integer findPersonalSpaceId(Integer userId) {
        return spaceRepository.findByOwnerIdAndIsPersonalTrue(userId)
                .map(Space::getId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND,
                        "Personal space not found for user " + userId));
    }
```

Add the matching repository method to `SpaceRepository.java`:

```java
    Optional<Space> findByOwnerIdAndIsPersonalTrue(Integer ownerId);
```

If a method with the same effect already exists (the existing `getPersonalSpace` endpoint must use one — check the controller/service before duplicating), use that and skip this step.

- [ ] **Step 5: Add `SpaceMemberRepository.countBySpace`**

Append to `SpaceMemberRepository.java` if not already present:

```java
    long countBySpace(Space space);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `./mvnw test -Dtest=DocumentToolsetImplTest`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/myjourney/agent/DocumentToolsetImpl.java \
        src/main/java/com/myjourney/service/SpaceService.java \
        src/main/java/com/myjourney/repository/SpaceRepository.java \
        src/main/java/com/myjourney/repository/SpaceMemberRepository.java \
        src/test/java/com/myjourney/agent/DocumentToolsetImplTest.java
git commit -m "Implement DocumentToolset on top of existing services"
```

---

### Task B5: ToolSchemas — Anthropic tool JSON schemas

The agent loop needs to register each tool with Anthropic. We hand-write the JSON schema once (lives next to the interface) so future MCP exposure can reuse the exact same strings.

**Files:**
- Create: `src/main/java/com/myjourney/agent/ToolSchemas.java`

- [ ] **Step 1: Write the schema constants**

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;

// JSON tool schemas advertised to Claude. The names match what the agent
// loop dispatches on, and the descriptions guide Claude's tool selection.
// Keep the names stable — MCP clients will rely on the same identifiers.
public final class ToolSchemas {

    private ToolSchemas() {}

    public static final String NAME_SEARCH_DOCUMENTS  = "search_documents";
    public static final String NAME_GET_DOCUMENT      = "get_document";
    public static final String NAME_LIST_SPACES       = "list_spaces";
    public static final String NAME_LIST_DOCUMENTS    = "list_documents";
    public static final String NAME_GET_COMMENTS      = "get_comments";
    public static final String NAME_CREATE_DOCUMENT   = "create_document";
    public static final String NAME_UPDATE_DOCUMENT   = "update_document";
    public static final String NAME_ADD_COMMENT       = "add_comment";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static JsonNode allSchemas() {
        try {
            return MAPPER.readTree("""
            [
              {
                "name": "search_documents",
                "description": "Search the user's knowledge base by keyword. Returns the top matching documents with snippets. Call get_document afterward to read full content. Use this whenever the user's question references things that may be in their notes or journal.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "query": {"type": "string", "description": "Search keywords"},
                    "space_id": {"type": ["integer","null"], "description": "Optional space id to restrict to. Null = search every space the user is a member of."},
                    "date_from": {"type": ["string","null"], "format": "date"},
                    "date_to":   {"type": ["string","null"], "format": "date"},
                    "tags":  {"type": ["array","null"], "items": {"type": "string"}, "description": "AND match"},
                    "limit": {"type": "integer", "default": 10, "maximum": 25}
                  },
                  "required": ["query"]
                }
              },
              {
                "name": "get_document",
                "description": "Fetch the full content of a document by id, including attachments and recent comments.",
                "input_schema": {
                  "type": "object",
                  "properties": { "document_id": {"type": "integer"} },
                  "required": ["document_id"]
                }
              },
              {
                "name": "list_spaces",
                "description": "List all spaces the user is a member of, with their personal-space flag and member count.",
                "input_schema": { "type": "object", "properties": {} }
              },
              {
                "name": "list_documents",
                "description": "Paginate documents inside a specific space, optionally filtered by docType (JOURNAL or NOTE), creation date, or a single tag.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "space_id": {"type": "integer"},
                    "doc_type": {"type": ["string","null"], "enum": ["JOURNAL", "NOTE", null]},
                    "since":    {"type": ["string","null"], "format": "date"},
                    "tag":      {"type": ["string","null"]},
                    "limit":    {"type": "integer", "default": 10, "maximum": 25},
                    "offset":   {"type": "integer", "default": 0}
                  },
                  "required": ["space_id"]
                }
              },
              {
                "name": "get_comments",
                "description": "Return comments on a document in chronological order.",
                "input_schema": {
                  "type": "object",
                  "properties": { "document_id": {"type": "integer"} },
                  "required": ["document_id"]
                }
              },
              {
                "name": "create_document",
                "description": "Create a new document. If space_id is omitted, creates in the user's personal space. entry_date is required when doc_type is JOURNAL.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "title":      {"type": "string"},
                    "content":    {"type": "string"},
                    "space_id":   {"type": ["integer","null"]},
                    "doc_type":   {"type": ["string","null"], "enum": ["JOURNAL", "NOTE", null], "default": "NOTE"},
                    "entry_date": {"type": ["string","null"], "format": "date"},
                    "tags":       {"type": ["array","null"], "items": {"type": "string"}}
                  },
                  "required": ["title", "content"]
                }
              },
              {
                "name": "update_document",
                "description": "Update an existing document. Only the author can update. Pass null for fields you do not want to change. Passing an empty list for tags clears all tags.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "document_id": {"type": "integer"},
                    "title":       {"type": ["string","null"]},
                    "content":     {"type": ["string","null"]},
                    "tags":        {"type": ["array","null"], "items": {"type": "string"}}
                  },
                  "required": ["document_id"]
                }
              },
              {
                "name": "add_comment",
                "description": "Add a comment to a document. Any space member can comment.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "document_id": {"type": "integer"},
                    "content":     {"type": "string"}
                  },
                  "required": ["document_id", "content"]
                }
              }
            ]
            """);
        } catch (Exception e) {
            throw new IllegalStateException("Bad tool schema JSON literal", e);
        }
    }

    public static List<String> names() {
        return List.of(
                NAME_SEARCH_DOCUMENTS, NAME_GET_DOCUMENT, NAME_LIST_SPACES,
                NAME_LIST_DOCUMENTS, NAME_GET_COMMENTS, NAME_CREATE_DOCUMENT,
                NAME_UPDATE_DOCUMENT, NAME_ADD_COMMENT);
    }
}
```

- [ ] **Step 2: Smoke-test the schema parses**

Add a tiny test:

Create: `src/test/java/com/myjourney/agent/ToolSchemasTest.java`

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ToolSchemasTest {
    @Test
    void allSchemas_parsesAndContainsAllEightTools() {
        JsonNode arr = ToolSchemas.allSchemas();
        assertThat(arr.isArray()).isTrue();
        assertThat(arr.size()).isEqualTo(8);
        for (int i = 0; i < arr.size(); i++) {
            assertThat(arr.get(i).get("name").asText()).isIn(ToolSchemas.names());
            assertThat(arr.get(i).get("input_schema")).isNotNull();
        }
    }
}
```

- [ ] **Step 3: Run test**

Run: `./mvnw test -Dtest=ToolSchemasTest`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/myjourney/agent/ToolSchemas.java \
        src/test/java/com/myjourney/agent/ToolSchemasTest.java
git commit -m "Add Anthropic tool schemas for the 8 agent tools"
```

---

## Section C — Anthropic Client + Agent Tool-Use Loop

### Task C1: AnthropicChatClient

A thin wrapper around the Anthropic Messages API. Existing `AiService` already calls the API with `RestTemplate`; this client is its tool-use cousin (multi-turn, with tools). Shares no state with `AiService`.

**Files:**
- Create: `src/main/java/com/myjourney/agent/AnthropicChatClient.java`

- [ ] **Step 1: Write the client**

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;

// HTTP wrapper for the Anthropic Messages API used by the agent loop.
// Keeps message construction and the API call in one place so AgentService
// can focus on the tool-use control flow.
@Component
public class AnthropicChatClient {

    private static final Logger log = LoggerFactory.getLogger(AnthropicChatClient.class);
    private static final String URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL = "claude-haiku-4-5-20251001";
    private static final int MAX_TOKENS = 1024;

    @Value("${anthropic.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * One Messages-API call with tools enabled.
     *
     * @param systemPrompt  short system instruction
     * @param messages      conversation history (USER / ASSISTANT objects in Anthropic shape).
     *                      Each element must be an ObjectNode like
     *                      {"role":"user","content":[ ... ]} or
     *                      {"role":"assistant","content":[ ... ]}.
     * @param tools         array of tool schemas (from ToolSchemas.allSchemas())
     * @return              the parsed top-level response JSON (has "content" array and "stop_reason")
     */
    public JsonNode complete(String systemPrompt, List<JsonNode> messages, JsonNode tools) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", MODEL);
        body.put("max_tokens", MAX_TOKENS);
        body.put("system", systemPrompt);
        ArrayNode arr = body.putArray("messages");
        for (JsonNode m : messages) arr.add(m);
        if (tools != null && tools.isArray() && tools.size() > 0) {
            body.set("tools", tools);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> req;
        try {
            req = new HttpEntity<>(mapper.writeValueAsString(body), headers);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize Anthropic request", e);
        }

        try {
            ResponseEntity<String> res = restTemplate.postForEntity(URL, req, String.class);
            return mapper.readTree(res.getBody());
        } catch (Exception e) {
            log.error("Anthropic API call failed", e);
            throw new RuntimeException("Anthropic API call failed", e);
        }
    }
}
```

- [ ] **Step 2: Compile**

Run: `./mvnw compile -q`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/agent/AnthropicChatClient.java
git commit -m "Add AnthropicChatClient (RestTemplate wrapper for chat + tools)"
```

---

### Task C2: AgentService — tool dispatcher

Pure Java logic that maps Anthropic tool_use blocks to `DocumentToolset` calls. Pulled into its own class so we can unit-test it without an Anthropic round-trip.

**Files:**
- Create: `src/main/java/com/myjourney/agent/ToolDispatcher.java`
- Test: `src/test/java/com/myjourney/agent/ToolDispatcherTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.agent.dto.ToolSearchResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ToolDispatcherTest {

    private DocumentToolset toolset;
    private ToolDispatcher dispatcher;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setup() {
        toolset = mock(DocumentToolset.class);
        dispatcher = new ToolDispatcher(toolset);
    }

    @Test
    void dispatch_searchDocuments_invokesToolsetWithParsedArgs() throws Exception {
        when(toolset.searchDocuments(eq(42), eq("onboarding"), isNull(),
                isNull(), isNull(), isNull(), eq(10)))
            .thenReturn(new ToolSearchResult(List.of()));

        JsonNode args = mapper.readTree("""
            {"query":"onboarding","limit":10}
            """);

        Object out = dispatcher.dispatch(42, "search_documents", args);

        assertThat(out).isInstanceOf(ToolSearchResult.class);
        verify(toolset).searchDocuments(42, "onboarding", null,
                null, null, null, 10);
    }
}
```

- [ ] **Step 2: Run test (fails)**

Run: `./mvnw test -Dtest=ToolDispatcherTest`
Expected: FAIL — `ToolDispatcher` class does not exist.

- [ ] **Step 3: Implement ToolDispatcher**

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.myjourney.exception.AppException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

// Parses an Anthropic tool_use block (name + input JSON) and calls the
// matching DocumentToolset method. Returns the toolset's return value so
// AgentService can serialize it back into a tool_result content block.
@Component
public class ToolDispatcher {

    private final DocumentToolset toolset;

    @Autowired
    public ToolDispatcher(DocumentToolset toolset) {
        this.toolset = toolset;
    }

    public Object dispatch(Integer userId, String toolName, JsonNode args) {
        return switch (toolName) {
            case ToolSchemas.NAME_SEARCH_DOCUMENTS -> toolset.searchDocuments(
                    userId,
                    str(args, "query"),
                    intOrNull(args, "space_id"),
                    date(args, "date_from"),
                    date(args, "date_to"),
                    strList(args, "tags"),
                    intOrDefault(args, "limit", 10));
            case ToolSchemas.NAME_GET_DOCUMENT -> toolset.getDocument(
                    userId,
                    longRequired(args, "document_id"));
            case ToolSchemas.NAME_LIST_SPACES -> toolset.listSpaces(userId);
            case ToolSchemas.NAME_LIST_DOCUMENTS -> toolset.listDocuments(
                    userId,
                    intOrNull(args, "space_id"),
                    strOrNull(args, "doc_type"),
                    date(args, "since"),
                    strOrNull(args, "tag"),
                    intOrDefault(args, "limit", 10),
                    intOrDefault(args, "offset", 0));
            case ToolSchemas.NAME_GET_COMMENTS -> toolset.getComments(
                    userId,
                    longRequired(args, "document_id"));
            case ToolSchemas.NAME_CREATE_DOCUMENT -> toolset.createDocument(
                    userId,
                    str(args, "title"),
                    str(args, "content"),
                    intOrNull(args, "space_id"),
                    strOrNull(args, "doc_type"),
                    date(args, "entry_date"),
                    strList(args, "tags"));
            case ToolSchemas.NAME_UPDATE_DOCUMENT -> toolset.updateDocument(
                    userId,
                    longRequired(args, "document_id"),
                    strOrNull(args, "title"),
                    strOrNull(args, "content"),
                    strList(args, "tags"));
            case ToolSchemas.NAME_ADD_COMMENT -> toolset.addComment(
                    userId,
                    longRequired(args, "document_id"),
                    str(args, "content"));
            default -> throw new AppException(HttpStatus.BAD_REQUEST,
                    "Unknown tool name: " + toolName);
        };
    }

    // ── arg parsers (Anthropic args are always a JSON object) ─────

    private static String str(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Missing required arg: " + key);
        }
        return args.get(key).asText();
    }
    private static String strOrNull(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) return null;
        return args.get(key).asText();
    }
    private static Integer intOrNull(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) return null;
        return args.get(key).asInt();
    }
    private static int intOrDefault(JsonNode args, String key, int def) {
        if (args == null || !args.has(key) || args.get(key).isNull()) return def;
        return args.get(key).asInt();
    }
    private static Long longRequired(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Missing required arg: " + key);
        }
        return args.get(key).asLong();
    }
    private static LocalDate date(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) return null;
        try {
            return LocalDate.parse(args.get(key).asText());
        } catch (Exception e) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Invalid date for " + key);
        }
    }
    private static List<String> strList(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) return null;
        List<String> out = new ArrayList<>();
        for (JsonNode n : args.get(key)) out.add(n.asText());
        return out;
    }
}
```

- [ ] **Step 4: Run test (passes)**

Run: `./mvnw test -Dtest=ToolDispatcherTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/myjourney/agent/ToolDispatcher.java \
        src/test/java/com/myjourney/agent/ToolDispatcherTest.java
git commit -m "Add ToolDispatcher (Anthropic tool_use -> toolset call)"
```

---

### Task C3: AgentService — conversation persistence

This task wires the message-store side of AgentService. The actual API loop lands in C4 so each commit is small.

**Files:**
- Create: `src/main/java/com/myjourney/agent/AgentService.java`

- [ ] **Step 1: Write the skeleton with persistence helpers**

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.myjourney.exception.AppException;
import com.myjourney.model.*;
import com.myjourney.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AgentService {

    // Hard cap from spec §5.2: max 10 tool calls per turn.
    static final int MAX_TOOL_ITERATIONS = 10;
    // Conversation cap from spec §5.4: 100 per (user, space); oldest pruned.
    static final int MAX_CONVERSATIONS_PER_SPACE = 100;

    @Autowired private AnthropicChatClient anthropic;
    @Autowired private ToolDispatcher dispatcher;
    @Autowired private AgentConversationRepository convRepo;
    @Autowired private AgentMessageRepository msgRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private SpaceRepository spaceRepo;
    @Autowired private SpaceMemberRepository memberRepo;

    private final ObjectMapper mapper = new ObjectMapper();

    @Transactional
    public AgentConversation startOrLoadConversation(Integer userId, Integer spaceId,
                                                      Long conversationId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
        Space space = spaceRepo.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));
        if (!memberRepo.existsBySpaceAndUser(space, user)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Not a member of this space");
        }

        if (conversationId != null) {
            AgentConversation c = convRepo.findById(conversationId)
                    .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Conversation not found"));
            if (!c.getUser().getId().equals(userId) || !c.getSpace().getId().equals(spaceId)) {
                throw new AppException(HttpStatus.FORBIDDEN, "Conversation not yours");
            }
            return c;
        }
        // Soft cap: prune oldest before creating a new conversation.
        long count = convRepo.countByUserAndSpace(user, space);
        if (count >= MAX_CONVERSATIONS_PER_SPACE) {
            List<AgentConversation> all = convRepo.findByUserAndSpaceOrderByUpdatedAtDesc(user, space);
            for (int i = MAX_CONVERSATIONS_PER_SPACE - 1; i < all.size(); i++) {
                convRepo.delete(all.get(i));
            }
        }
        AgentConversation c = new AgentConversation();
        c.setUser(user);
        c.setSpace(space);
        c.setTitle("Untitled");
        return convRepo.save(c);
    }

    @Transactional
    public AgentMessage persistMessage(AgentConversation conv, AgentMessage.Role role, JsonNode content) {
        AgentMessage m = new AgentMessage();
        m.setConversation(conv);
        m.setRole(role);
        m.setContent(content);
        return msgRepo.save(m);
    }

    @Transactional
    public void renameConversationFromFirstMessage(AgentConversation conv, String userText) {
        if (conv.getTitle() != null && !conv.getTitle().equals("Untitled")) return;
        String title = userText.length() > 80 ? userText.substring(0, 80) : userText;
        conv.setTitle(title);
        convRepo.save(conv);
    }

    // Helper used by the loop: build an Anthropic message object from a stored AgentMessage row.
    public JsonNode toAnthropicMessage(AgentMessage m) {
        ObjectNode node = mapper.createObjectNode();
        if (m.getRole() == AgentMessage.Role.USER) {
            node.put("role", "user");
            node.set("content", m.getContent());     // already an array of content blocks
        } else if (m.getRole() == AgentMessage.Role.ASSISTANT) {
            node.put("role", "assistant");
            node.set("content", m.getContent());
        } else { // TOOL — Anthropic represents tool_result as a user-role message
            node.put("role", "user");
            node.set("content", m.getContent());
        }
        return node;
    }

    ObjectMapper mapper() { return mapper; }
}
```

- [ ] **Step 2: Compile**

Run: `./mvnw compile -q`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/agent/AgentService.java
git commit -m "Add AgentService skeleton with conversation persistence"
```

---

### Task C4: AgentService — tool-use loop

**Files:**
- Modify: `src/main/java/com/myjourney/agent/AgentService.java`
- Test: `src/test/java/com/myjourney/agent/AgentServiceLoopTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.agent.dto.ToolSearchResult;
import com.myjourney.model.*;
import com.myjourney.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@Transactional
class AgentServiceLoopTest {

    @Autowired AgentService service;
    @Autowired UserRepository userRepository;
    @Autowired SpaceRepository spaceRepository;
    @Autowired SpaceMemberRepository memberRepository;
    @Autowired AgentConversationRepository convRepo;

    @MockBean AnthropicChatClient anthropic;
    @MockBean DocumentToolset toolset;

    private final ObjectMapper mapper = new ObjectMapper();
    private AgentConversation conv;

    @BeforeEach
    void setup() {
        reset(anthropic, toolset);

        // Bootstrap a user + personal space + membership + conversation.
        // Mirrors the pattern in DocumentServiceCrossSpaceSearchTest /
        // TestDataFixture — if the User / Space entity requires additional
        // not-null fields (e.g. provider, password hash) read those entities
        // first and set them here. Don't @Autowire a separate fixture class;
        // keep the setup inline so the test is self-contained.
        User u = new User();
        u.setUsername("alice");
        u.setEmail("alice@example.com");
        u.setPassword("x");
        u = userRepository.save(u);

        Space s = new Space();
        s.setName("Personal");
        s.setOwner(u);
        s.setPersonal(true);
        s = spaceRepository.save(s);

        SpaceMember m = new SpaceMember();
        m.setSpace(s);
        m.setUser(u);
        m.setRole("OWNER");
        memberRepository.save(m);

        AgentConversation c = new AgentConversation();
        c.setUser(u);
        c.setSpace(s);
        c.setTitle("Untitled");
        conv = convRepo.save(c);
    }

    @Test
    void runTurn_callsTool_thenReturnsTextAnswer() throws Exception {
        // 1st API response: tool_use(search_documents). 2nd: pure text answer.
        JsonNode toolUseResp = mapper.readTree("""
            {
              "stop_reason": "tool_use",
              "content": [
                {"type":"tool_use","id":"t1","name":"search_documents",
                 "input":{"query":"onboarding","limit":5}}
              ]
            }
            """);
        JsonNode finalResp = mapper.readTree("""
            {
              "stop_reason": "end_turn",
              "content": [
                {"type":"text","text":"Here is what I found: ..."}
              ]
            }
            """);
        when(anthropic.complete(anyString(), anyList(), any()))
                .thenReturn(toolUseResp, finalResp);
        when(toolset.searchDocuments(any(), eq("onboarding"), any(), any(), any(), any(), eq(5)))
                .thenReturn(new ToolSearchResult(List.of()));

        StringBuilder out = new StringBuilder();
        Consumer<String> sink = out::append;
        service.runTurn(conv, "what about onboarding?", List.of(), sink);

        assertThat(out.toString()).contains("Here is what I found");
        verify(anthropic, times(2)).complete(anyString(), anyList(), any());
        verify(toolset).searchDocuments(any(), eq("onboarding"), any(), any(), any(), any(), eq(5));
    }
}
```

- [ ] **Step 2: Run test to confirm failure**

Run: `./mvnw test -Dtest=AgentServiceLoopTest`
Expected: FAIL — `service.runTurn(...)` method not found.

- [ ] **Step 3: Implement `runTurn` on AgentService**

Append to `AgentService.java`:

```java
    private static final String SYSTEM_PROMPT_TEMPLATE = """
            You are an assistant for the My Journey knowledge base.
            The user's current scope is the space "%s".
            Use the provided tools to find relevant documents before answering.
            Always cite documents by id like [doc:123] when you reference them.
            Be concise. Plain text only — no markdown headers.
            """;

    /**
     * Runs one user turn: persists the USER message, calls Anthropic in a loop
     * (executing tool_use blocks as they appear), persists each ASSISTANT and
     * TOOL turn, and streams final assistant text via `sink` (called with each
     * delta — for now, the whole final text in one call; SSE chunking lives in
     * the controller).
     */
    @Transactional
    public void runTurn(AgentConversation conv,
                        String userText,
                        List<JsonNode> userContentBlocks,
                        java.util.function.Consumer<String> sink) {
        // Persist USER message. Content is either the plain text (wrapped in
        // a content block) or the caller-supplied content blocks (which already
        // contain text + image/document blocks for multimodal turns).
        java.util.List<JsonNode> userContent = new java.util.ArrayList<>();
        if (userContentBlocks != null && !userContentBlocks.isEmpty()) {
            userContent.addAll(userContentBlocks);
        } else {
            ObjectNode textBlock = mapper.createObjectNode();
            textBlock.put("type", "text");
            textBlock.put("text", userText);
            userContent.add(textBlock);
        }
        com.fasterxml.jackson.databind.node.ArrayNode userContentArr = mapper.createArrayNode();
        for (JsonNode n : userContent) userContentArr.add(n);
        persistMessage(conv, AgentMessage.Role.USER, userContentArr);
        renameConversationFromFirstMessage(conv, userText);

        String systemPrompt = String.format(SYSTEM_PROMPT_TEMPLATE, conv.getSpace().getName());

        java.util.List<JsonNode> history = new java.util.ArrayList<>();
        java.util.List<AgentMessage> prior = msgRepo.findByConversationOrderByCreatedAtAsc(conv);
        // Slide window: last 20 messages (spec §5.2)
        int from = Math.max(0, prior.size() - 20);
        for (int i = from; i < prior.size(); i++) {
            history.add(toAnthropicMessage(prior.get(i)));
        }

        JsonNode tools = ToolSchemas.allSchemas();

        for (int iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
            JsonNode res = anthropic.complete(systemPrompt, history, tools);
            JsonNode contentArr = res.get("content");
            // Persist the assistant turn verbatim (the loop needs to replay this on the next iter).
            persistMessage(conv, AgentMessage.Role.ASSISTANT, contentArr);
            ObjectNode asAsst = mapper.createObjectNode();
            asAsst.put("role", "assistant");
            asAsst.set("content", contentArr);
            history.add(asAsst);

            String stop = res.has("stop_reason") ? res.get("stop_reason").asText("") : "";
            if (!"tool_use".equals(stop)) {
                // Stream final text to the sink. Anthropic returns one or more
                // text blocks — concatenate them.
                StringBuilder finalText = new StringBuilder();
                for (JsonNode block : contentArr) {
                    if ("text".equals(block.path("type").asText())) {
                        finalText.append(block.path("text").asText());
                    }
                }
                sink.accept(finalText.toString());
                return;
            }

            // Execute each tool_use block, collect results into a single tool_result content array.
            com.fasterxml.jackson.databind.node.ArrayNode toolResults = mapper.createArrayNode();
            for (JsonNode block : contentArr) {
                if (!"tool_use".equals(block.path("type").asText())) continue;
                String name  = block.path("name").asText();
                String useId = block.path("id").asText();
                JsonNode args = block.path("input");
                ObjectNode result = mapper.createObjectNode();
                result.put("type", "tool_result");
                result.put("tool_use_id", useId);
                try {
                    Object out = dispatcher.dispatch(conv.getUser().getId(), name, args);
                    result.set("content", mapper.valueToTree(out));
                    result.put("is_error", false);
                } catch (Exception e) {
                    result.put("content", "Tool error: " + e.getMessage());
                    result.put("is_error", true);
                }
                toolResults.add(result);
            }
            // Persist a TOOL turn (a user-role message with tool_result blocks per Anthropic spec).
            persistMessage(conv, AgentMessage.Role.TOOL, toolResults);
            ObjectNode asTool = mapper.createObjectNode();
            asTool.put("role", "user");
            asTool.set("content", toolResults);
            history.add(asTool);
        }

        // Hit the iteration cap — surface a graceful partial answer.
        sink.accept("\n(I had to stop after 10 tool calls — let me know if you want me to keep going.)");
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./mvnw test -Dtest=AgentServiceLoopTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/myjourney/agent/AgentService.java \
        src/test/java/com/myjourney/agent/AgentServiceLoopTest.java
git commit -m "Add AgentService.runTurn (tool-use loop with persistence)"
```

---

## Section D — REST + SSE

### Task D1: Agent DTOs

**Files:**
- Create: `src/main/java/com/myjourney/dto/agent/AgentChatRequest.java`
- Create: `src/main/java/com/myjourney/dto/agent/AgentConversationResponse.java`
- Create: `src/main/java/com/myjourney/dto/agent/AgentMessageResponse.java`

- [ ] **Step 1: Write the DTOs**

```java
// AgentChatRequest.java
package com.myjourney.dto.agent;
import java.util.List;
public record AgentChatRequest(
        Integer spaceId,
        Long conversationId,        // null = new conversation
        String message,
        List<String> attachmentUrls // optional, Cloudinary URLs the user uploaded earlier
) {}
```

```java
// AgentConversationResponse.java
package com.myjourney.dto.agent;
import java.time.LocalDateTime;
public record AgentConversationResponse(
        Long id,
        Integer spaceId,
        String title,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
```

```java
// AgentMessageResponse.java
package com.myjourney.dto.agent;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
public record AgentMessageResponse(
        Long id,
        String role,         // USER | ASSISTANT | TOOL
        JsonNode content,
        LocalDateTime createdAt
) {}
```

- [ ] **Step 2: Compile**

Run: `./mvnw compile -q`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/dto/agent/
git commit -m "Add agent chat DTOs"
```

---

### Task D2: AgentChatController — list conversations + get messages (non-streaming)

**Files:**
- Create: `src/main/java/com/myjourney/controller/AgentChatController.java`
- Test: `src/test/java/com/myjourney/controller/AgentChatControllerTest.java`

- [ ] **Step 1: Write the controller**

```java
package com.myjourney.controller;

import com.myjourney.agent.AgentService;
import com.myjourney.dto.agent.AgentConversationResponse;
import com.myjourney.dto.agent.AgentMessageResponse;
import com.myjourney.exception.AppException;
import com.myjourney.model.AgentConversation;
import com.myjourney.model.AgentMessage;
import com.myjourney.repository.AgentConversationRepository;
import com.myjourney.repository.AgentMessageRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin
@RequestMapping("/api/agent")
public class AgentChatController {

    @Autowired private AgentService agentService;
    @Autowired private AgentConversationRepository convRepo;
    @Autowired private AgentMessageRepository msgRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private SpaceRepository spaceRepo;
    @Autowired private JwtUtil jwtUtil;

    // GET /api/agent/conversations?spaceId=...
    @GetMapping("/conversations")
    public ResponseEntity<List<AgentConversationResponse>> listConversations(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam Integer spaceId) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        var user = userRepo.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
        var space = spaceRepo.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));
        var convs = convRepo.findByUserAndSpaceOrderByUpdatedAtDesc(user, space);
        return ResponseEntity.ok(convs.stream()
                .map(c -> new AgentConversationResponse(
                        c.getId(), space.getId(), c.getTitle(),
                        c.getCreatedAt(), c.getUpdatedAt()))
                .toList());
    }

    // GET /api/agent/conversations/{id}/messages
    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<AgentMessageResponse>> listMessages(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        AgentConversation c = convRepo.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Conversation not found"));
        if (!c.getUser().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Conversation not yours");
        }
        return ResponseEntity.ok(
                msgRepo.findByConversationOrderByCreatedAtAsc(c).stream()
                        .map(m -> new AgentMessageResponse(
                                m.getId(), m.getRole().name(),
                                m.getContent(), m.getCreatedAt()))
                        .toList());
    }
}
```

- [ ] **Step 2: Write a small MockMvc test exercising both endpoints**

```java
package com.myjourney.controller;

import com.myjourney.model.*;
import com.myjourney.repository.*;
import com.myjourney.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AgentChatControllerTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository userRepo;
    @Autowired SpaceRepository spaceRepo;
    @Autowired SpaceMemberRepository memberRepo;
    @Autowired AgentConversationRepository convRepo;
    @Autowired JwtUtil jwt;

    User user;
    Space space;
    String token;

    @BeforeEach
    void setup() {
        user = new User();
        user.setUsername("alice");
        user.setEmail("alice@example.com");
        user.setPassword("x");
        user = userRepo.save(user);

        space = new Space();
        space.setName("Personal");
        space.setOwner(user);
        space.setPersonal(true);
        space = spaceRepo.save(space);

        SpaceMember m = new SpaceMember();
        m.setSpace(space);
        m.setUser(user);
        m.setRole("OWNER");
        memberRepo.save(m);

        token = "Bearer " + jwt.generateAccessToken(user);
    }

    @Test
    void listConversations_emptyToStart_thenReturnsCreated() throws Exception {
        // empty
        mvc.perform(get("/api/agent/conversations").param("spaceId", String.valueOf(space.getId()))
                        .header("Authorization", token))
                .andExpect(status().isOk());

        // seed one
        AgentConversation c = new AgentConversation();
        c.setUser(user);
        c.setSpace(space);
        c.setTitle("hello");
        convRepo.save(c);

        mvc.perform(get("/api/agent/conversations").param("spaceId", String.valueOf(space.getId()))
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("hello"));
    }
}
```

Note: if `JwtUtil.generateAccessToken(User)` doesn't exist with that exact name, look up the real signature (likely `generateToken(User)` or `generateAccessToken(Integer userId)`). Adjust the line above to match. Do not invent a method that doesn't exist.

- [ ] **Step 3: Run test**

Run: `./mvnw test -Dtest=AgentChatControllerTest`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/myjourney/controller/AgentChatController.java \
        src/test/java/com/myjourney/controller/AgentChatControllerTest.java
git commit -m "Add AgentChatController: list conversations + get messages"
```

---

### Task D3: AgentChatController — POST /api/agent/chat with SSE

**Files:**
- Modify: `src/main/java/com/myjourney/controller/AgentChatController.java`

- [ ] **Step 1: Add the SSE endpoint**

Append the following inside `AgentChatController`:

```java
    // POST /api/agent/chat — opens an SSE stream. The server sends:
    //   event: meta   data: {"conversationId": 42}
    //   event: delta  data: {"text": "..."}        (one or more)
    //   event: done   data: {}
    //
    // If something goes wrong the server sends event:error then closes.
    // We don't true-stream Anthropic deltas yet (no streaming HTTP client);
    // the SSE shape is forward-compatible with a future streaming Anthropic call.
    @PostMapping(value = "/chat",
                 produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter chat(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody com.myjourney.dto.agent.AgentChatRequest req) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) throw new AppException(HttpStatus.UNAUTHORIZED, "Auth required");
        if (req.message() == null || req.message().isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "message is required");
        }
        if (req.spaceId() == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "spaceId is required");
        }

        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter =
                new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(60_000L);

        // Run the LLM call on a separate thread so the controller returns the
        // emitter immediately; the emitter is closed inside the runnable when
        // the assistant's text is fully streamed (or on error).
        Thread.startVirtualThread(() -> {
            try {
                AgentConversation conv = agentService.startOrLoadConversation(
                        userId, req.spaceId(), req.conversationId());

                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                        .name("meta")
                        .data("{\"conversationId\":" + conv.getId() + "}"));

                // Build user content blocks if attachment URLs are present (image
                // attachments only for now; PDF support is layered in Task F2).
                java.util.List<com.fasterxml.jackson.databind.JsonNode> userBlocks =
                        com.myjourney.agent.MultimodalBuilder.fromAttachmentUrls(
                                req.attachmentUrls(), req.message());

                agentService.runTurn(conv, req.message(), userBlocks, chunk -> {
                    try {
                        emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                                .name("delta")
                                .data("{\"text\":" + jsonStr(chunk) + "}"));
                    } catch (java.io.IOException e) {
                        emitter.completeWithError(e);
                    }
                });
                emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                        .name("done").data("{}"));
                emitter.complete();
            } catch (Exception e) {
                try {
                    emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event()
                            .name("error")
                            .data("{\"message\":" + jsonStr(e.getMessage()) + "}"));
                } catch (Exception ignored) {}
                emitter.completeWithError(e);
            }
        });
        return emitter;
    }

    // Minimal JSON-string escape so we can hand-craft "data:" payloads.
    private static String jsonStr(String s) {
        if (s == null) return "\"\"";
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"'  -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default   -> sb.append(c);
            }
        }
        sb.append("\"");
        return sb.toString();
    }
```

`MultimodalBuilder` will land in Task F1 — until then, add a temporary stub:

Create: `src/main/java/com/myjourney/agent/MultimodalBuilder.java`

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

// Stubbed in this commit. Real image / PDF handling lives in tasks F1, F2.
public final class MultimodalBuilder {
    private MultimodalBuilder() {}
    public static List<JsonNode> fromAttachmentUrls(List<String> urls, String userText) {
        return List.of();
    }
}
```

- [ ] **Step 2: Compile**

Run: `./mvnw compile -q`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Smoke-test the SSE endpoint manually**

Run the app: `./mvnw spring-boot:run` (in another terminal).

Then in a shell, use a JWT from logging in via the existing /api/login and curl:

```bash
TOKEN="<paste your bearer token>"
curl -N -X POST http://localhost:8080/api/agent/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"spaceId":<your personal space id>,"message":"hi"}'
```

Expected: a stream of SSE events (`event: meta`, `event: delta`, `event: done`). The actual text reply will be Claude's response.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/myjourney/controller/AgentChatController.java \
        src/main/java/com/myjourney/agent/MultimodalBuilder.java
git commit -m "Add POST /api/agent/chat (SSE streaming)"
```

---

### Task D4: Rate limit `/api/agent/chat`

**Files:**
- Modify: `src/main/java/com/myjourney/filter/RateLimitFilter.java`

- [ ] **Step 1: Read the existing filter and find the bucket assembly**

Read the file fully so you know how existing per-userId buckets are constructed (the AI endpoints are already capped). The new bucket should follow the same shape.

- [ ] **Step 2: Add a 20-msg/hour-per-user bucket for `/api/agent/chat`**

Inside the path branching block in `RateLimitFilter` (next to the `/api/entries/ai-*` branch), add:

```java
        // Agent chat: 20 msgs / hour / user (spec §5.5)
        if (path.equals("/api/agent/chat")) {
            Integer userId = userIdFromAuth(request);
            if (userId == null) return; // unauth path will 401 downstream
            Bucket bucket = agentChatBuckets.computeIfAbsent(userId, k ->
                    Bucket.builder()
                            .addLimit(Bandwidth.classic(20,
                                    Refill.intervally(20, Duration.ofHours(1))))
                            .build());
            if (!bucket.tryConsume(1)) {
                response.setStatus(429);
                response.getWriter().write("Agent chat rate limit exceeded. Try again later.");
                return;
            }
            return;
        }
```

Add the per-user bucket map as a field next to the existing maps:

```java
    private final java.util.concurrent.ConcurrentHashMap<Integer, Bucket> agentChatBuckets =
            new java.util.concurrent.ConcurrentHashMap<>();
```

If the file uses a different naming pattern (`ratelimitAi` vs `aiBuckets`), match it. The engineer should read the existing code before pasting.

- [ ] **Step 3: Manually verify (or write a test if one exists for other buckets)**

Run: `./mvnw test -Dtest=RateLimitFilterTest 2>&1 | tail -10`

If a `RateLimitFilterTest` exists, run it. If it doesn't, hit the endpoint 21 times in quick succession with curl (Step 3 of D3) and confirm the 21st returns HTTP 429.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/myjourney/filter/RateLimitFilter.java
git commit -m "Rate-limit /api/agent/chat at 20 msg/hour/user"
```

---

## Section E — Multimodal Input (Images + PDFs)

### Task E1: MultimodalBuilder — images

**Files:**
- Modify: `src/main/java/com/myjourney/agent/MultimodalBuilder.java`
- Test: `src/test/java/com/myjourney/agent/MultimodalBuilderTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MultimodalBuilderTest {

    @Test
    void fromAttachmentUrls_buildsImageBlockForEachImage_andOneTextBlock() {
        List<String> urls = List.of(
                "https://res.cloudinary.com/foo/image/upload/v1/x.jpg",
                "https://res.cloudinary.com/foo/image/upload/v1/y.png");

        List<JsonNode> blocks = MultimodalBuilder.fromAttachmentUrls(urls, "what are these?");

        assertThat(blocks).hasSize(3);
        assertThat(blocks.get(0).get("type").asText()).isEqualTo("image");
        assertThat(blocks.get(0).get("source").get("url").asText()).contains("x.jpg");
        assertThat(blocks.get(1).get("type").asText()).isEqualTo("image");
        assertThat(blocks.get(2).get("type").asText()).isEqualTo("text");
        assertThat(blocks.get(2).get("text").asText()).isEqualTo("what are these?");
    }
}
```

- [ ] **Step 2: Run test (fails — current stub returns empty list)**

Run: `./mvnw test -Dtest=MultimodalBuilderTest`
Expected: FAIL.

- [ ] **Step 3: Implement image block construction**

Replace `MultimodalBuilder.java` body with:

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.List;

// Builds Anthropic content blocks for a user message that includes
// previously-uploaded Cloudinary attachments. Images become image blocks
// (Anthropic supports URL-source images). PDF support lands in Task F2.
public final class MultimodalBuilder {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private MultimodalBuilder() {}

    public static List<JsonNode> fromAttachmentUrls(List<String> urls, String userText) {
        List<JsonNode> blocks = new ArrayList<>();
        if (urls != null) {
            for (String url : urls) {
                if (url == null || url.isBlank()) continue;
                if (looksLikeImage(url)) blocks.add(imageBlock(url));
                // Non-image attachments without an explicit handler are dropped
                // in this iteration; PDF handling lands in F2.
            }
        }
        if (userText != null && !userText.isBlank()) {
            ObjectNode text = MAPPER.createObjectNode();
            text.put("type", "text");
            text.put("text", userText);
            blocks.add(text);
        }
        return blocks;
    }

    private static boolean looksLikeImage(String url) {
        String low = url.toLowerCase();
        return low.endsWith(".jpg") || low.endsWith(".jpeg") || low.endsWith(".png")
                || low.endsWith(".gif") || low.endsWith(".webp")
                || low.contains("/image/upload/");
    }

    private static JsonNode imageBlock(String url) {
        ObjectNode block = MAPPER.createObjectNode();
        block.put("type", "image");
        ObjectNode source = block.putObject("source");
        source.put("type", "url");
        source.put("url", url);
        return block;
    }
}
```

- [ ] **Step 4: Run test (passes)**

Run: `./mvnw test -Dtest=MultimodalBuilderTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/myjourney/agent/MultimodalBuilder.java \
        src/test/java/com/myjourney/agent/MultimodalBuilderTest.java
git commit -m "MultimodalBuilder: convert image URLs to vision blocks"
```

---

### Task E2: PDF input support

**Files:**
- Modify: `src/main/java/com/myjourney/agent/MultimodalBuilder.java`
- Modify: `src/test/java/com/myjourney/agent/MultimodalBuilderTest.java`

PDFs are sent to Anthropic as a `document` content block (per Anthropic's PDF input docs). We fetch the URL → base64 → embed. To keep this in-process and respect the 2 GB VPS memory budget, we cap at 5 MB per file.

- [ ] **Step 1: Add a failing test**

Append to `MultimodalBuilderTest.java`:

```java
    @Test
    void fromAttachmentUrls_pdfBecomesDocumentBlock_smallEnough() {
        // Use a deterministic local fixture URL; the test uses a stubbed fetcher
        // (see Step 2) so no network call happens.
        List<String> urls = List.of("https://example.com/test.pdf");

        List<JsonNode> blocks = MultimodalBuilder.fromAttachmentUrls(
                urls, "summarize this");

        assertThat(blocks).hasSize(2);
        assertThat(blocks.get(0).get("type").asText()).isEqualTo("document");
        assertThat(blocks.get(0).get("source").get("type").asText()).isEqualTo("base64");
        assertThat(blocks.get(0).get("source").get("media_type").asText()).isEqualTo("application/pdf");
        assertThat(blocks.get(1).get("type").asText()).isEqualTo("text");
    }
```

Right above the existing test, add a setUp that injects a stub fetcher:

```java
import org.junit.jupiter.api.BeforeEach;

    @BeforeEach
    void setup() {
        MultimodalBuilder.setPdfFetcherForTesting(url -> "JVBERi0xLjQK".getBytes()); // "%PDF-1.4\n" in base64
    }
```

- [ ] **Step 2: Add PDF support to the builder**

Replace the body of `MultimodalBuilder.java` with:

```java
package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.function.Function;

public final class MultimodalBuilder {

    private static final Logger log = LoggerFactory.getLogger(MultimodalBuilder.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int MAX_PDF_BYTES = 5 * 1024 * 1024;

    // Tests inject a stub so they don't hit the network.
    private static Function<String, byte[]> pdfFetcher = MultimodalBuilder::fetchPdfDefault;

    static void setPdfFetcherForTesting(Function<String, byte[]> f) { pdfFetcher = f; }

    private MultimodalBuilder() {}

    public static List<JsonNode> fromAttachmentUrls(List<String> urls, String userText) {
        List<JsonNode> blocks = new ArrayList<>();
        if (urls != null) {
            for (String url : urls) {
                if (url == null || url.isBlank()) continue;
                if (looksLikeImage(url)) {
                    blocks.add(imageBlock(url));
                } else if (looksLikePdf(url)) {
                    JsonNode pdf = pdfBlock(url);
                    if (pdf != null) blocks.add(pdf);
                }
            }
        }
        if (userText != null && !userText.isBlank()) {
            ObjectNode text = MAPPER.createObjectNode();
            text.put("type", "text");
            text.put("text", userText);
            blocks.add(text);
        }
        return blocks;
    }

    private static boolean looksLikeImage(String url) {
        String low = url.toLowerCase();
        return low.endsWith(".jpg") || low.endsWith(".jpeg") || low.endsWith(".png")
                || low.endsWith(".gif") || low.endsWith(".webp")
                || low.contains("/image/upload/");
    }

    private static boolean looksLikePdf(String url) {
        return url.toLowerCase().endsWith(".pdf");
    }

    private static JsonNode imageBlock(String url) {
        ObjectNode block = MAPPER.createObjectNode();
        block.put("type", "image");
        ObjectNode source = block.putObject("source");
        source.put("type", "url");
        source.put("url", url);
        return block;
    }

    private static JsonNode pdfBlock(String url) {
        byte[] bytes;
        try {
            bytes = pdfFetcher.apply(url);
        } catch (Exception e) {
            log.warn("PDF fetch failed for {}: {}", url, e.getMessage());
            return null;
        }
        if (bytes == null || bytes.length == 0) return null;
        if (bytes.length > MAX_PDF_BYTES) {
            log.warn("PDF {} too large ({} bytes); skipping", url, bytes.length);
            return null;
        }
        ObjectNode block = MAPPER.createObjectNode();
        block.put("type", "document");
        ObjectNode source = block.putObject("source");
        source.put("type", "base64");
        source.put("media_type", "application/pdf");
        source.put("data", Base64.getEncoder().encodeToString(bytes));
        return block;
    }

    private static byte[] fetchPdfDefault(String url) {
        try {
            HttpResponse<byte[]> res = HttpClient.newHttpClient().send(
                    HttpRequest.newBuilder(URI.create(url)).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            return res.body();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
```

- [ ] **Step 3: Run test**

Run: `./mvnw test -Dtest=MultimodalBuilderTest`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/myjourney/agent/MultimodalBuilder.java \
        src/test/java/com/myjourney/agent/MultimodalBuilderTest.java
git commit -m "MultimodalBuilder: PDF input via base64 document blocks"
```

---

## Section F — Frontend Chat Panel

The chat panel is a right-drawer on desktop (≥ 768 px) and a full-page route on mobile. Both share the same `ChatPanel` component; the parent decides the chrome (drawer vs route).

### Task F1: API wrapper + types

**Files:**
- Create: `frontend/src/types/agent.ts`
- Create: `frontend/src/api/agent.ts`

- [ ] **Step 1: Write the types**

```ts
// frontend/src/types/agent.ts

export interface AgentConversation {
  id: number
  spaceId: number
  title: string
  createdAt: string
  updatedAt: string
}

// A single persisted turn. `content` shape varies by role:
//   USER:      [{ type:'text', text }, ...image blocks...]
//   ASSISTANT: [{ type:'text', text } | { type:'tool_use', ... }]
//   TOOL:      [{ type:'tool_result', tool_use_id, content }]
export interface AgentMessage {
  id: number
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  content: unknown
  createdAt: string
}

export interface AgentChatRequest {
  spaceId: number
  conversationId?: number
  message: string
  attachmentUrls?: string[]
}
```

- [ ] **Step 2: Write the API wrapper**

```ts
// frontend/src/api/agent.ts
import { apiRequest } from './client'
import type { AgentConversation, AgentMessage, AgentChatRequest } from '@/types/agent'

export function listAgentConversations(spaceId: number): Promise<AgentConversation[]> {
  return apiRequest(`/agent/conversations?spaceId=${spaceId}`)
}

export function getAgentMessages(conversationId: number): Promise<AgentMessage[]> {
  return apiRequest(`/agent/conversations/${conversationId}/messages`)
}

// Opens an SSE connection by streaming the POST body. We use fetch + a manual
// reader so we can send a request body (EventSource is GET-only). Returns the
// AbortController so the caller can cancel mid-stream.
export type ChatStreamHandlers = {
  onMeta?:  (m: { conversationId: number }) => void
  onDelta?: (d: { text: string }) => void
  onDone?:  () => void
  onError?: (e: { message: string }) => void
}

export function streamAgentChat(
  req: AgentChatRequest,
  handlers: ChatStreamHandlers,
): AbortController {
  const ctrl = new AbortController()
  const token = localStorage.getItem('accessToken') || ''
  fetch('/api/agent/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(req),
    signal: ctrl.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      handlers.onError?.({ message: `HTTP ${res.status}` })
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE frames are separated by a blank line.
      let idx
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const event = parseSseFrame(frame)
        if (!event) continue
        try {
          const data = JSON.parse(event.data)
          if (event.name === 'meta')  handlers.onMeta?.(data)
          if (event.name === 'delta') handlers.onDelta?.(data)
          if (event.name === 'done')  handlers.onDone?.()
          if (event.name === 'error') handlers.onError?.(data)
        } catch {
          // Ignore non-JSON frames; surface as a warning in dev.
          if (import.meta.env.DEV) console.warn('SSE non-JSON frame:', event)
        }
      }
    }
    handlers.onDone?.()
  }).catch(err => {
    if (err.name !== 'AbortError') handlers.onError?.({ message: String(err) })
  })
  return ctrl
}

// SSE frame parser: looks for 'event:' and 'data:' lines.
function parseSseFrame(frame: string): { name: string; data: string } | null {
  const lines = frame.split('\n')
  let name = 'message'
  let data = ''
  for (const line of lines) {
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  return data ? { name, data } : null
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: BUILD SUCCESS (empty output).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/agent.ts frontend/src/api/agent.ts
git commit -m "Add agent API wrapper + SSE streaming helper"
```

---

### Task F2: ChatPanel component (desktop + mobile)

**Files:**
- Create: `frontend/src/pages/agent/ChatPanel.tsx`
- Create: `frontend/src/pages/agent/ChatPanel.css`

- [ ] **Step 1: Write the CSS**

```css
/* frontend/src/pages/agent/ChatPanel.css */

.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  border-left: 1px solid var(--separator);
}

.chat-panel__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--separator);
  position: sticky;
  top: 0;
  background: var(--bg-primary-translucent);
  backdrop-filter: blur(8px);
  z-index: 1;
}

.chat-panel__scope {
  font-size: 13px;
  color: var(--label-secondary);
}

.chat-panel__history {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-panel__msg {
  max-width: 88%;
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 14.5px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.chat-panel__msg--user {
  align-self: flex-end;
  background: var(--accent);
  color: var(--accent-on);
}

.chat-panel__msg--assistant {
  align-self: flex-start;
  background: var(--bg-secondary);
  color: var(--label-primary);
}

.chat-panel__cite {
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline dotted;
}

.chat-panel__composer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--separator);
  background: var(--bg-primary);
}

.chat-panel__textarea {
  flex: 1;
  resize: none;
  min-height: 38px;
  max-height: 140px;
  padding: 9px 12px;
  font: inherit;
  border-radius: 18px;
  border: 1px solid var(--separator);
  background: var(--bg-secondary);
  color: var(--label-primary);
}

.chat-panel__send {
  align-self: flex-end;
  padding: 8px 14px;
  border-radius: 18px;
  background: var(--accent);
  color: var(--accent-on);
  border: 1px solid transparent;
  font-size: 14px;
  cursor: pointer;
}
.chat-panel__send:disabled { opacity: .5; cursor: default; }

@media (max-width: 767px) {
  .chat-panel { border-left: none; }
  .chat-panel__msg { max-width: 92%; }
}
```

- [ ] **Step 2: Write the component**

```tsx
// frontend/src/pages/agent/ChatPanel.tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { streamAgentChat, getAgentMessages, listAgentConversations } from '@/api/agent'
import type { AgentConversation, AgentMessage } from '@/types/agent'
import './ChatPanel.css'

interface Props {
  spaceId: number
  spaceName: string
  onClose?: () => void
}

interface UiMessage {
  role: 'USER' | 'ASSISTANT'
  text: string
}

// ChatPanel renders the conversation thread + composer for one space.
// Loads the most recent conversation for that space on mount (or starts
// fresh if there isn't one). Citations like [doc:42] in assistant text
// are converted into clickable links to /journal/42 (personal docs) or
// /spaces/<id>/documents/42 (lookup via route already exists).
export default function ChatPanel({ spaceId, spaceName, onClose }: Props) {
  const navigate = useNavigate()
  const [conversationId, setConversationId] = useState<number | undefined>()
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const ctrlRef   = useRef<AbortController | null>(null)

  // Load the most recent conversation for this space (if any).
  useEffect(() => {
    let cancelled = false
    listAgentConversations(spaceId).then(async (convs: AgentConversation[]) => {
      if (cancelled || convs.length === 0) return
      const c = convs[0]
      setConversationId(c.id)
      const msgs: AgentMessage[] = await getAgentMessages(c.id)
      const ui: UiMessage[] = []
      for (const m of msgs) {
        if (m.role === 'TOOL') continue
        const text = extractText(m.content)
        if (text) ui.push({ role: m.role as 'USER' | 'ASSISTANT', text })
      }
      if (!cancelled) setMessages(ui)
    }).catch(() => { /* fresh start */ })
    return () => { cancelled = true; ctrlRef.current?.abort() }
  }, [spaceId])

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages(m => [...m, { role: 'USER', text }, { role: 'ASSISTANT', text: '' }])
    setSending(true)

    let assistantBuf = ''
    ctrlRef.current?.abort()
    ctrlRef.current = streamAgentChat(
      { spaceId, conversationId, message: text },
      {
        onMeta:  m => setConversationId(m.conversationId),
        onDelta: d => {
          assistantBuf += d.text
          setMessages(prev => {
            const copy = [...prev]
            copy[copy.length - 1] = { role: 'ASSISTANT', text: assistantBuf }
            return copy
          })
        },
        onDone:  () => setSending(false),
        onError: e => {
          setMessages(prev => {
            const copy = [...prev]
            copy[copy.length - 1] = {
              role: 'ASSISTANT',
              text: `Sorry, something went wrong: ${e.message}`,
            }
            return copy
          })
          setSending(false)
        },
      },
    )
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel__topbar">
        <span className="chat-panel__scope">Searching: {spaceName}</span>
        {onClose && (
          <button onClick={onClose} aria-label="Close">×</button>
        )}
      </div>

      <div className="chat-panel__history" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i}
               className={`chat-panel__msg chat-panel__msg--${m.role === 'USER' ? 'user' : 'assistant'}`}>
            {renderTextWithCitations(m.text, docId => {
              // Personal docs and shared-space docs both route to /journal or /spaces.
              // The agent persists doc IDs; we follow the same convention DocumentDetailPage uses.
              navigate(`/journal/${docId}`)
            })}
          </div>
        ))}
      </div>

      <div className="chat-panel__composer">
        <textarea
          className="chat-panel__textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask anything about this space..."
          rows={1}
        />
        <button className="chat-panel__send" onClick={handleSend} disabled={sending || !input.trim()}>
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// Walks the persisted Anthropic content block array and returns concatenated text.
function extractText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  let out = ''
  for (const b of content as Array<{ type?: string; text?: string }>) {
    if (b?.type === 'text' && typeof b.text === 'string') out += b.text
  }
  return out
}

// Find [doc:<digits>] patterns and render them as clickable spans.
function renderTextWithCitations(text: string, onClick: (id: number) => void) {
  const parts: React.ReactNode[] = []
  const regex = /\[doc:(\d+)\]/g
  let last = 0, match
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const id = Number(match[1])
    parts.push(
      <span key={key++} className="chat-panel__cite"
            role="link" onClick={() => onClick(id)}>
        #{id}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/agent/ChatPanel.tsx frontend/src/pages/agent/ChatPanel.css
git commit -m "Add ChatPanel component (desktop + mobile)"
```

---

### Task F3: Mount ChatPanel as desktop drawer in SpaceDetailPage

**Files:**
- Modify: `frontend/src/pages/spaces/SpaceDetailPage.tsx`

- [ ] **Step 1: Add the drawer state + "Ask AI" topbar button**

Open `SpaceDetailPage.tsx`. Add imports:

```tsx
import { useState } from 'react'
import ChatPanel from '@/pages/agent/ChatPanel'
import Icon from '@/components/ui/Icon'
```

Inside the component, add state:

```tsx
const [chatOpen, setChatOpen] = useState(false)
```

In the existing `PageTopBar actions={...}` prop, add the "Ask AI" button **before** the existing buttons:

```tsx
<button
  className="sdetail-btn"
  onClick={() => setChatOpen(v => !v)}
  aria-label="Ask AI"
>
  <Icon name="ai" size={16} />
  Ask AI
</button>
```

At the end of the component's returned JSX (after the existing `</div>` that closes `sdetail-inner`), add the drawer overlay:

```tsx
{chatOpen && (
  <div className="sdetail-chat-overlay" onClick={e => {
    if (e.target === e.currentTarget) setChatOpen(false)
  }}>
    <aside className="sdetail-chat-drawer">
      <ChatPanel
        spaceId={Number(spaceId)}
        spaceName={space?.name ?? 'this space'}
        onClose={() => setChatOpen(false)}
      />
    </aside>
  </div>
)}
```

- [ ] **Step 2: Add drawer CSS**

Open (or create) the existing `SpaceDetail.css`. Append:

```css
/* Right-side drawer for ChatPanel on space detail. Mobile uses the
   dedicated /spaces/:id/chat route instead — drawer is desktop-only. */
.sdetail-chat-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 50;
  display: flex;
  justify-content: flex-end;
}

.sdetail-chat-drawer {
  width: min(420px, 90vw);
  height: 100%;
  background: var(--bg-primary);
  box-shadow: -2px 0 24px rgba(0, 0, 0, 0.18);
  animation: sdetail-chat-slidein 220ms ease-out;
}

@keyframes sdetail-chat-slidein {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

@media (max-width: 767px) {
  .sdetail-chat-overlay { display: none; }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/spaces/SpaceDetailPage.tsx \
        frontend/src/pages/spaces/SpaceDetail.css
git commit -m "Mount ChatPanel as desktop drawer on SpaceDetailPage"
```

---

### Task F4: Mobile full-page chat route

**Files:**
- Create: `frontend/src/pages/agent/AgentChatPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/spaces/SpaceDetailPage.tsx`

Mobile: instead of opening the overlay drawer (poor ergonomics on 390 px), the "Ask AI" button navigates to `/spaces/:id/chat` which renders `ChatPanel` full-screen.

- [ ] **Step 1: Write AgentChatPage**

```tsx
// frontend/src/pages/agent/AgentChatPage.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ChatPanel from '@/pages/agent/ChatPanel'
import PageTopBar from '@/components/ui/PageTopBar'
import { getSpace } from '@/api/spaces'
import type { SpaceDetail } from '@/types/api'

// Full-page chat used on mobile (< 768 px). Desktop uses the drawer in
// SpaceDetailPage. Reuses the same ChatPanel component — only the chrome
// differs.
export default function AgentChatPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [space, setSpace] = useState<SpaceDetail | null>(null)

  useEffect(() => {
    if (!id) return
    getSpace(Number(id)).then(setSpace).catch(() => setSpace(null))
  }, [id])

  if (!id) return null
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageTopBar
        title={space?.name ?? 'Ask AI'}
        backTo={`/spaces/${id}`}
        onBack={() => navigate(-1)}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatPanel spaceId={Number(id)} spaceName={space?.name ?? 'this space'} />
      </div>
    </div>
  )
}
```

Note: if `PageTopBar` doesn't already accept `backTo`/`onBack` props matching the above, look at its existing API and adapt — e.g., use `actions={<BackButton />}` if that's the established pattern. Don't invent prop names.

- [ ] **Step 2: Wire the route in App.tsx**

Add the import:

```tsx
import AgentChatPage from '@/pages/agent/AgentChatPage'
```

Inside the route block, next to the existing space routes:

```tsx
<Route path="/spaces/:id/chat" element={<AgentChatPage />} />
```

- [ ] **Step 3: Update the "Ask AI" button to route on mobile**

In `SpaceDetailPage.tsx`, replace the existing onClick:

```tsx
onClick={() => {
  if (window.matchMedia('(max-width: 767px)').matches) {
    navigate(`/spaces/${spaceId}/chat`)
  } else {
    setChatOpen(v => !v)
  }
}}
```

Add the `useNavigate` import if not already present.

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/agent/AgentChatPage.tsx \
        frontend/src/App.tsx \
        frontend/src/pages/spaces/SpaceDetailPage.tsx
git commit -m "Add mobile /spaces/:id/chat full-page route for AgentChatPage"
```

---

## Section G — End-to-End Verification

### Task G1: Manual smoke checklist (desktop)

Run: `./mvnw spring-boot:run` in one terminal and `cd frontend && npm run dev` in another.

- [ ] **Step 1: Log in to the app at http://localhost:5173 (or whatever your Vite port is).**

- [ ] **Step 2: Open a Space (Personal or any shared space).**

- [ ] **Step 3: Click "Ask AI" in the page top bar.**
  Expected: drawer slides in from the right; chat scope chip shows "Searching: <space name>".

- [ ] **Step 4: Type "list my recent documents" and press Enter.**
  Expected: a USER bubble appears, then an ASSISTANT bubble streams in text that references actual doc titles (or says "no documents yet").

- [ ] **Step 5: Type "summarize document #1" (replace #1 with a real doc id).**
  Expected: assistant fetches via get_document tool and returns a summary that cites `[doc:1]` — the citation must render as a clickable link that opens `/journal/1` (or the equivalent space-doc route).

- [ ] **Step 6: Reload the page, reopen the drawer.**
  Expected: prior messages are visible (conversation persistence works).

- [ ] **Step 7: Hit `/api/agent/chat` 21 times in a loop with curl.**
  Expected: 21st call returns HTTP 429.

---

### Task G2: Manual smoke checklist (mobile, 390 px)

- [ ] **Step 1: Open dev tools, set viewport to 390 px (iPhone 14 size).**

- [ ] **Step 2: Open a Space and tap "Ask AI" in the top bar.**
  Expected: full-page navigation to `/spaces/:id/chat`. No overlay drawer.

- [ ] **Step 3: Send a message; verify the composer textarea stays visible above the keyboard area, the history scrolls correctly, and the topbar back button returns to the space.**

- [ ] **Step 4: Verify the AI scope chip + composer fit within 390 px without horizontal scroll.**

---

### Task G3: Final commit + push

- [ ] **Step 1: Confirm all sections complete and tests pass.**

Run: `./mvnw test -q`
Expected: BUILD SUCCESS.

Run: `cd frontend && npx tsc --noEmit`
Expected: empty output.

- [ ] **Step 2: Push the branch.**

```bash
git push origin dev
```

---

## Out-of-scope follow-ups (captured for the MCP plan)

- `mcp_api_token` + `mcp_access_log` tables — spec §3.1 puts them in this batch, but the MCP server itself is a separate sub-project. Defer table creation to the MCP plan to keep this batch focused.
- Real Anthropic streaming (deltas come back as a single chunk today). Worth revisiting when Anthropic Java SDK lands.
- Frontend test infra (vitest + @testing-library/react). Worth a dedicated batch later — adding it inside this batch would balloon scope.
- Conversation export (spec §13 open question).
- Citation routing for cross-space docs (the current `navigate(/journal/:id)` works for personal-space JOURNAL docs; NOTE docs need `/spaces/:spaceId/documents/:docId`. The agent can be prompted to emit `[doc:42|space:7]` patterns later — out of scope here).
