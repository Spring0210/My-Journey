# MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing 9-tool `DocumentToolset` over an MCP Streamable-HTTP server at `/mcp`, gated by user-issued API tokens, so external clients (Claude Desktop, Cursor) can search/read/write a user's knowledge base with the same authorization as the Web UI.

**Architecture:** Reuse `DocumentToolset` (the same interface backing the internal agent) as the single business-logic surface. A new servlet filter (`McpAuthenticationFilter`) authenticates `Authorization: Bearer mj_<token>` requests by SHA-256-hashed lookup in `mcp_api_token`, sets the Spring `SecurityContext` to that user's id, and stashes the token id on the request. A hand-rolled `McpJsonRpcController` at `POST /mcp` parses the JSON-RPC 2.0 envelope and dispatches the methods we need — `initialize`, `tools/list`, `tools/call`, `ping`, and the `notifications/initialized` no-op — delegating `tools/call` to a thin `McpToolBridge` that translates args → `ToolDispatcher` invocations → JSON results, writes one `mcp_access_log` row per call, and bumps `last_used_at`. `GET /mcp` returns 405 (the server doesn't push server-initiated messages, which the MCP spec permits). Rate limits and the daily token-expiry sweep / 30-day log purge piggy-back on the existing Bucket4j filter and a new `@Scheduled` bean. Frontend gets a new `Profile → MCP Access` page for token CRUD and a "Recent activity" list.

**Tech Stack:** Java 21, Spring Boot 3.4.5, Spring Security, Spring Data JPA, Bucket4j (existing), MySQL 8, hand-rolled JSON-RPC 2.0 over `POST /mcp` (no external MCP SDK — implements the slice of the MCP Streamable-HTTP spec actually used by Claude Desktop / Cursor for tool-only servers), React 18 + TypeScript + Vite, Vitest + React Testing Library.

---

## File Structure

### Backend — new files

| File | Responsibility |
|------|----------------|
| `src/main/java/com/myjourney/service/McpTokenService.java` | Generate raw token (`mj_` + 32 url-safe base64 chars), SHA-256 hash, persist, list, revoke, verify by hash, async bump `last_used_at`, write `mcp_access_log`. |
| `src/main/java/com/myjourney/filter/McpAuthenticationFilter.java` | OncePerRequestFilter. Active only on `/mcp/**`. Reads `Authorization: Bearer mj_<token>`, hashes, looks up, checks `expired_at`, sets `SecurityContext`. Returns 401 on miss/expired. |
| `src/main/java/com/myjourney/controller/McpJsonRpcController.java` | Hand-rolled JSON-RPC 2.0 over `POST /mcp`. Parses envelope, dispatches `initialize` / `tools/list` / `tools/call` / `ping` / `notifications/initialized`. Returns 405 on `GET /mcp`. No `@CrossOrigin` (spec §6.5 — MCP is not browser-facing). |
| `src/main/java/com/myjourney/mcp/McpProtocol.java` | Protocol constants (supported MCP version, JSON-RPC error codes, method names) and tiny envelope helpers (`success(id, result)`, `error(id, code, msg)`, `toolResultContent(text, isError)`). Pure static — no Spring beans. |
| `src/main/java/com/myjourney/mcp/McpToolBridge.java` | Per-call adapter: takes (token id, tool name, args JsonNode), invokes `ToolDispatcher.dispatch(...)`, serializes the return DTO with Jackson, writes the access log, bumps `last_used_at`, returns `Result(payloadJson, isError)`. Owns the audit side effects so `ToolDispatcher` stays agent-only. |
| `src/main/java/com/myjourney/controller/McpTokenController.java` | REST under `/api/profile/mcp`. `POST /tokens` (create + reveal raw token once), `GET /tokens` (list, no raw values), `DELETE /tokens/{id}` (revoke = hard delete), `GET /activity` (last 50 access log entries across user's tokens). |
| `src/main/java/com/myjourney/dto/mcp/CreateMcpTokenRequest.java` | `{ name, expiryDays }` (expiryDays ∈ {30, 90, 365}, defaults 30). |
| `src/main/java/com/myjourney/dto/mcp/McpTokenResponse.java` | `{ id, name, prefix, createdAt, lastUsedAt, expiredAt }` — no raw token, no hash. |
| `src/main/java/com/myjourney/dto/mcp/McpTokenCreatedResponse.java` | `McpTokenResponse + rawToken` — returned only from `POST /tokens`. |
| `src/main/java/com/myjourney/dto/mcp/McpAccessLogResponse.java` | `{ tokenName, prefix, toolName, calledAt, success }`. |
| `src/main/java/com/myjourney/scheduler/McpMaintenanceScheduler.java` | `@Scheduled` daily: delete tokens where `expired_at < now`, purge `mcp_access_log` rows older than 30 days. |

### Backend — modified files

| File | Change |
|------|--------|
| `src/main/java/com/myjourney/MyJourneyApplication.java` | Add `@EnableScheduling` and `@EnableAsync`. |
| `src/main/java/com/myjourney/config/SecurityConfig.java` | (a) wire `McpAuthenticationFilter` before `JwtAuthenticationFilter`; (b) `/mcp/**` permitAll at HTTP-level (filter does the auth); (c) `/api/profile/mcp/**` authenticated. |
| `src/main/java/com/myjourney/filter/JwtAuthenticationFilter.java` | `shouldNotFilter` returns `true` for `/mcp/**` — JWT must not run on the MCP path. |
| `src/main/java/com/myjourney/filter/RateLimitFilter.java` | Add two new bucket maps: per-token `mcp_60_per_min`, per-user `mcp_1000_per_day`. Apply only on `/mcp/**`. |

### Backend — test files

| File | Coverage |
|------|----------|
| `src/test/java/com/myjourney/service/McpTokenServiceTest.java` | Token format, hash determinism, verify happy/expired/missing, list/revoke. |
| `src/test/java/com/myjourney/filter/McpAuthenticationFilterTest.java` | Valid token → SecurityContext set; missing/wrong-prefix/expired → 401; non-`/mcp` paths skipped. |
| `src/test/java/com/myjourney/mcp/McpToolBridgeTest.java` | Dispatches to `ToolDispatcher`, writes access log row (success + failure), bumps `last_used_at`, serializes result. |
| `src/test/java/com/myjourney/controller/McpTokenControllerTest.java` | Slice test for CRUD + activity endpoint. |
| `src/test/java/com/myjourney/scheduler/McpMaintenanceSchedulerTest.java` | Expired tokens removed; old log rows purged; live ones preserved. |
| `src/test/java/com/myjourney/controller/McpJsonRpcControllerTest.java` | Slice (`@WebMvcTest`): one test per JSON-RPC method (initialize / tools/list / tools/call / ping / notifications/initialized / unknown). |
| `src/test/java/com/myjourney/mcp/McpServerIntegrationTest.java` | Full `@SpringBootTest`: POST a JSON-RPC `initialize` then `tools/list` to `/mcp` with a real token, verify response shape; second test asserts missing-Bearer → 401. |

### Frontend — new files

| File | Responsibility |
|------|----------------|
| `frontend/src/api/mcp.ts` | Typed wrappers around `/api/profile/mcp/*`. |
| `frontend/src/pages/profile/McpAccessPage.tsx` | Token list, "New token" modal (name + expiry → reveal-once), revoke, recent-activity table, copy-pastable Claude Desktop JSON. |
| `frontend/src/pages/profile/McpAccessPage.test.tsx` | RTL tests for list rendering, create flow, reveal-once, revoke. |

### Frontend — modified files

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add `<Route path="/profile/mcp" element={<McpAccessPage />} />`. |
| `frontend/src/pages/profile/ProfilePage.tsx` | Add a new section "Integrations" with one row → "MCP Access" linking to `/profile/mcp`. |
| `frontend/src/pages/profile/Profile.css` | Minor: reuse `prof-row` styles; no new tokens. |
| `frontend/src/types/index.ts` (if it exists) or per-file types | Declare `McpToken`, `McpTokenCreated`, `McpAccessLogEntry`. |

### Docs

| File | Change |
|------|--------|
| `README.md` | Append "MCP Setup" section with Claude Desktop JSON snippet (matches the page UI). |

---

## Phase 1 — Token Service

The token service owns: cryptographic generation, hashing, persistence, lookup, and the access-log side effects. Filters and controllers call into it; they don't touch repositories directly.

### Task 1.1: Add helper methods to repositories

**Files:**
- Modify: `src/main/java/com/myjourney/repository/McpApiTokenRepository.java`
- Modify: `src/main/java/com/myjourney/repository/McpAccessLogRepository.java`

- [ ] **Step 1: Extend `McpApiTokenRepository` with cleanup + activity queries**

Replace the file's contents with:

```java
package com.myjourney.repository;

import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface McpApiTokenRepository extends JpaRepository<McpApiToken, Long> {

    // Token authentication: look up by SHA-256 hash of the bearer token.
    Optional<McpApiToken> findByTokenHash(String tokenHash);

    List<McpApiToken> findByUserOrderByCreatedAtDesc(User user);

    // Daily expiry sweep: hard-delete tokens whose expired_at has passed.
    @Modifying
    @Query("delete from McpApiToken t where t.expiredAt < :cutoff")
    int deleteExpired(@Param("cutoff") LocalDateTime cutoff);

    // Async last_used_at bump. Issued from the bridge after each tool call so
    // the user can see "last seen 2 minutes ago" on the MCP Access page.
    @Modifying
    @Query("update McpApiToken t set t.lastUsedAt = :now where t.id = :id")
    int touchLastUsedAt(@Param("id") Long id, @Param("now") LocalDateTime now);
}
```

- [ ] **Step 2: Extend `McpAccessLogRepository` with user-scoped activity query**

Replace contents with:

```java
package com.myjourney.repository;

import com.myjourney.model.McpAccessLog;
import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface McpAccessLogRepository extends JpaRepository<McpAccessLog, Long> {

    Page<McpAccessLog> findByTokenOrderByCalledAtDesc(McpApiToken token, Pageable pageable);

    // Recent activity panel: 50 most recent calls across all of the user's tokens.
    @Query("select l from McpAccessLog l where l.token.user = :user order by l.calledAt desc")
    List<McpAccessLog> findRecentByUser(@Param("user") User user, Pageable pageable);

    // 30-day retention purge.
    long deleteByCalledAtBefore(LocalDateTime cutoff);
}
```

- [ ] **Step 3: Compile**

Run: `./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/myjourney/repository/McpApiTokenRepository.java \
        src/main/java/com/myjourney/repository/McpAccessLogRepository.java
git commit -m "Extend MCP repositories with cleanup + activity queries"
```

### Task 1.2: McpTokenService — write the failing test first

**Files:**
- Create: `src/test/java/com/myjourney/service/McpTokenServiceTest.java`

- [ ] **Step 1: Create the test file**

```java
package com.myjourney.service;

import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.repository.McpApiTokenRepository;
import com.myjourney.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class McpTokenServiceTest {

    private McpApiTokenRepository tokenRepo;
    private McpAccessLogRepository logRepo;
    private UserRepository userRepo;
    private McpTokenService service;

    @BeforeEach
    void setup() {
        tokenRepo = mock(McpApiTokenRepository.class);
        logRepo   = mock(McpAccessLogRepository.class);
        userRepo  = mock(UserRepository.class);
        service   = new McpTokenService(tokenRepo, logRepo, userRepo);
    }

    @Test
    void createToken_returnsRawTokenWithMjPrefix_andPersistsHashOnly() {
        User user = new User();
        user.setId(7);
        when(userRepo.findById(7)).thenReturn(Optional.of(user));
        when(tokenRepo.save(any(McpApiToken.class))).thenAnswer(inv -> inv.getArgument(0));

        McpTokenService.CreatedToken result = service.createToken(7, "Claude Desktop", 30);

        assertThat(result.rawToken()).startsWith("mj_");
        assertThat(result.rawToken()).hasSizeGreaterThanOrEqualTo(35);

        ArgumentCaptor<McpApiToken> captor = ArgumentCaptor.forClass(McpApiToken.class);
        verify(tokenRepo).save(captor.capture());
        McpApiToken saved = captor.getValue();

        // The raw token must NOT be stored anywhere.
        assertThat(saved.getTokenHash()).isNotEqualTo(result.rawToken());
        assertThat(saved.getTokenHash()).hasSize(64); // SHA-256 hex
        assertThat(saved.getPrefix()).isEqualTo(result.rawToken().substring(0, 8));
        assertThat(saved.getName()).isEqualTo("Claude Desktop");
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getExpiredAt()).isAfter(LocalDateTime.now().plusDays(29));
    }

    @Test
    void verifyToken_returnsTokenWhenHashMatchesAndNotExpired() {
        McpApiToken stored = new McpApiToken();
        stored.setId(42L);
        stored.setExpiredAt(LocalDateTime.now().plusDays(10));
        when(tokenRepo.findByTokenHash(any())).thenReturn(Optional.of(stored));

        Optional<McpApiToken> result = service.verifyToken("mj_anything");

        assertThat(result).containsSame(stored);
    }

    @Test
    void verifyToken_returnsEmptyWhenExpired() {
        McpApiToken stored = new McpApiToken();
        stored.setId(42L);
        stored.setExpiredAt(LocalDateTime.now().minusDays(1));
        when(tokenRepo.findByTokenHash(any())).thenReturn(Optional.of(stored));

        Optional<McpApiToken> result = service.verifyToken("mj_anything");

        assertThat(result).isEmpty();
    }

    @Test
    void verifyToken_returnsEmptyForMissingPrefix() {
        Optional<McpApiToken> result = service.verifyToken("not_mj_prefixed");
        assertThat(result).isEmpty();
        verify(tokenRepo, never()).findByTokenHash(any());
    }

    @Test
    void verifyToken_returnsEmptyForNullOrBlank() {
        assertThat(service.verifyToken(null)).isEmpty();
        assertThat(service.verifyToken("")).isEmpty();
        assertThat(service.verifyToken("   ")).isEmpty();
    }

    @Test
    void touchLastUsed_callsRepository() {
        service.touchLastUsed(42L);
        verify(tokenRepo).touchLastUsedAt(eqLong(42L), any(LocalDateTime.class));
    }

    private static long eqLong(long v) { return org.mockito.ArgumentMatchers.eq(v); }

    @Test
    void revokeToken_deletesWhenOwnedByCaller() {
        McpApiToken stored = new McpApiToken();
        stored.setId(42L);
        User owner = new User(); owner.setId(7);
        stored.setUser(owner);
        when(tokenRepo.findById(42L)).thenReturn(Optional.of(stored));

        service.revokeToken(7, 42L);

        verify(tokenRepo).delete(stored);
    }

    @Test
    void revokeToken_throwsWhenNotOwner() {
        McpApiToken stored = new McpApiToken();
        stored.setId(42L);
        User owner = new User(); owner.setId(99);
        stored.setUser(owner);
        when(tokenRepo.findById(42L)).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.revokeToken(7, 42L))
                .hasMessageContaining("not yours");
        verify(tokenRepo, never()).delete(any());
    }

    @Test
    void recordAccess_writesLogRow() {
        McpApiToken token = new McpApiToken();
        token.setId(42L);

        service.recordAccess(token, "search_documents", true);

        ArgumentCaptor<com.myjourney.model.McpAccessLog> captor =
                ArgumentCaptor.forClass(com.myjourney.model.McpAccessLog.class);
        verify(logRepo).save(captor.capture());
        assertThat(captor.getValue().getToken()).isSameAs(token);
        assertThat(captor.getValue().getToolName()).isEqualTo("search_documents");
        assertThat(captor.getValue().isSuccess()).isTrue();
    }
}
```

- [ ] **Step 2: Run test to verify it fails (class not yet created)**

Run: `./mvnw -q test -Dtest=McpTokenServiceTest`
Expected: COMPILATION ERROR — symbol `McpTokenService` not found.

### Task 1.3: McpTokenService — implementation

**Files:**
- Create: `src/main/java/com/myjourney/service/McpTokenService.java`

- [ ] **Step 1: Create the service**

```java
package com.myjourney.service;

import com.myjourney.exception.AppException;
import com.myjourney.model.McpAccessLog;
import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.repository.McpApiTokenRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

// Owns the lifecycle of MCP API tokens. The raw token is only ever seen by
// the caller of createToken(); we persist SHA-256(rawToken) and never the
// raw value. verifyToken() is what McpAuthenticationFilter calls on every
// /mcp request.
@Service
public class McpTokenService {

    public static final String TOKEN_PREFIX = "mj_";
    private static final int    RANDOM_BYTES = 24;          // 32 base64url chars
    private static final int    PREFIX_LEN   = 8;
    private static final SecureRandom RNG    = new SecureRandom();

    private final McpApiTokenRepository tokenRepo;
    private final McpAccessLogRepository logRepo;
    private final UserRepository userRepo;

    public McpTokenService(McpApiTokenRepository tokenRepo,
                           McpAccessLogRepository logRepo,
                           UserRepository userRepo) {
        this.tokenRepo = tokenRepo;
        this.logRepo   = logRepo;
        this.userRepo  = userRepo;
    }

    // Result envelope: the controller returns rawToken once and discards it.
    public record CreatedToken(McpApiToken token, String rawToken) {}

    public CreatedToken createToken(Integer userId, String name, int expiryDays) {
        if (name == null || name.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Token name is required");
        }
        if (expiryDays != 30 && expiryDays != 90 && expiryDays != 365) {
            throw new AppException(HttpStatus.BAD_REQUEST,
                    "expiryDays must be 30, 90 or 365");
        }
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        String raw = generateRawToken();
        McpApiToken t = new McpApiToken();
        t.setUser(user);
        t.setName(name.trim());
        t.setTokenHash(sha256Hex(raw));
        t.setPrefix(raw.substring(0, PREFIX_LEN));
        t.setExpiredAt(LocalDateTime.now(ZoneOffset.UTC).plusDays(expiryDays));
        McpApiToken saved = tokenRepo.save(t);
        return new CreatedToken(saved, raw);
    }

    public List<McpApiToken> listTokens(Integer userId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
        return tokenRepo.findByUserOrderByCreatedAtDesc(user);
    }

    public void revokeToken(Integer userId, Long tokenId) {
        McpApiToken t = tokenRepo.findById(tokenId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Token not found"));
        if (!t.getUser().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Token not yours");
        }
        tokenRepo.delete(t);
    }

    public Optional<McpApiToken> verifyToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();
        String trimmed = rawToken.trim();
        if (!trimmed.startsWith(TOKEN_PREFIX)) return Optional.empty();
        Optional<McpApiToken> hit = tokenRepo.findByTokenHash(sha256Hex(trimmed));
        return hit.filter(t -> t.getExpiredAt().isAfter(LocalDateTime.now(ZoneOffset.UTC)));
    }

    // Issued async from McpToolBridge after every successful tool call. Kept
    // as a separate @Transactional method so it can run on a different thread
    // without dragging the calling tx along.
    @Async
    @Transactional
    public void touchLastUsed(Long tokenId) {
        tokenRepo.touchLastUsedAt(tokenId, LocalDateTime.now(ZoneOffset.UTC));
    }

    // Audit log row. Synchronous (not @Async) because we always have an
    // active session and the latency is negligible -- pushing it to a pool
    // would only complicate failure handling for ~1ms savings.
    public void recordAccess(McpApiToken token, String toolName, boolean success) {
        McpAccessLog log = new McpAccessLog();
        log.setToken(token);
        log.setToolName(toolName);
        log.setSuccess(success);
        logRepo.save(log);
    }

    // -- token primitives -------------------------------------------

    private static String generateRawToken() {
        byte[] bytes = new byte[RANDOM_BYTES];
        RNG.nextBytes(bytes);
        return TOKEN_PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
```

- [ ] **Step 2: Run the test and verify it passes**

Run: `./mvnw -q test -Dtest=McpTokenServiceTest`
Expected: 9 tests passed.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/service/McpTokenService.java \
        src/test/java/com/myjourney/service/McpTokenServiceTest.java
git commit -m "Add McpTokenService: generation, hashing, verification, audit log"
```

### Task 1.4: Enable async on the application

**Files:**
- Modify: `src/main/java/com/myjourney/MyJourneyApplication.java`

- [ ] **Step 1: Add EnableAsync + EnableScheduling**

Replace the file with:

```java
package com.myjourney;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
public class MyJourneyApplication {

    public static void main(String[] args) {
        SpringApplication.run(MyJourneyApplication.class, args);
    }
}
```

- [ ] **Step 2: Run the existing app boot test**

Run: `./mvnw -q test -Dtest=MyJourneyApplicationTests`
Expected: PASS — context loads with both new annotations.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/MyJourneyApplication.java
git commit -m "Enable async + scheduling for MCP token maintenance"
```

---

## Phase 2 — Token CRUD REST Endpoints

### Task 2.1: DTOs

**Files:**
- Create: `src/main/java/com/myjourney/dto/mcp/CreateMcpTokenRequest.java`
- Create: `src/main/java/com/myjourney/dto/mcp/McpTokenResponse.java`
- Create: `src/main/java/com/myjourney/dto/mcp/McpTokenCreatedResponse.java`
- Create: `src/main/java/com/myjourney/dto/mcp/McpAccessLogResponse.java`

- [ ] **Step 1: Request body**

```java
package com.myjourney.dto.mcp;

public record CreateMcpTokenRequest(String name, Integer expiryDays) {}
```

- [ ] **Step 2: List/list-item response (no raw token, no hash)**

```java
package com.myjourney.dto.mcp;

import com.myjourney.model.McpApiToken;

import java.time.LocalDateTime;

public record McpTokenResponse(
        Long id,
        String name,
        String prefix,
        LocalDateTime createdAt,
        LocalDateTime lastUsedAt,
        LocalDateTime expiredAt) {

    public static McpTokenResponse from(McpApiToken t) {
        return new McpTokenResponse(
                t.getId(), t.getName(), t.getPrefix(),
                t.getCreatedAt(), t.getLastUsedAt(), t.getExpiredAt());
    }
}
```

- [ ] **Step 3: Reveal-once response (only returned from POST /tokens)**

```java
package com.myjourney.dto.mcp;

public record McpTokenCreatedResponse(McpTokenResponse token, String rawToken) {}
```

- [ ] **Step 4: Recent-activity row**

```java
package com.myjourney.dto.mcp;

import com.myjourney.model.McpAccessLog;

import java.time.LocalDateTime;

public record McpAccessLogResponse(
        String tokenName,
        String prefix,
        String toolName,
        LocalDateTime calledAt,
        boolean success) {

    public static McpAccessLogResponse from(McpAccessLog log) {
        return new McpAccessLogResponse(
                log.getToken().getName(),
                log.getToken().getPrefix(),
                log.getToolName(),
                log.getCalledAt(),
                log.isSuccess());
    }
}
```

- [ ] **Step 5: Compile**

Run: `./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/myjourney/dto/mcp/
git commit -m "Add MCP token DTOs"
```

### Task 2.2: McpTokenController — write the failing test

**Files:**
- Create: `src/test/java/com/myjourney/controller/McpTokenControllerTest.java`

- [ ] **Step 1: Create the slice test**

```java
package com.myjourney.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.service.McpTokenService;
import com.myjourney.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = McpTokenController.class)
@org.springframework.security.test.context.support.WithMockUser
class McpTokenControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;

    @MockBean private McpTokenService tokenService;
    @MockBean private McpAccessLogRepository logRepo;
    @MockBean private com.myjourney.repository.UserRepository userRepo;
    @MockBean private JwtUtil jwtUtil;

    @BeforeEach
    void stubAuth() {
        when(jwtUtil.extractUserIdFromHeader(any())).thenReturn(7);
    }

    @Test
    void createToken_returnsRawTokenOnce() throws Exception {
        User u = new User(); u.setId(7);
        McpApiToken saved = new McpApiToken();
        saved.setId(42L); saved.setUser(u); saved.setName("Claude Desktop");
        saved.setPrefix("mj_abcde"); saved.setCreatedAt(LocalDateTime.now());
        saved.setExpiredAt(LocalDateTime.now().plusDays(30));
        when(tokenService.createToken(7, "Claude Desktop", 30))
                .thenReturn(new McpTokenService.CreatedToken(saved, "mj_rawvalue123"));

        mvc.perform(post("/api/profile/mcp/tokens")
                        .header("Authorization", "Bearer jwt")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Claude Desktop\",\"expiryDays\":30}")
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rawToken").value("mj_rawvalue123"))
                .andExpect(jsonPath("$.token.id").value(42));
    }

    @Test
    void listTokens_neverIncludesRawValue() throws Exception {
        User u = new User(); u.setId(7);
        McpApiToken t = new McpApiToken();
        t.setId(42L); t.setUser(u); t.setName("Claude Desktop");
        t.setPrefix("mj_abcde"); t.setCreatedAt(LocalDateTime.now());
        t.setExpiredAt(LocalDateTime.now().plusDays(30));
        when(tokenService.listTokens(7)).thenReturn(List.of(t));

        mvc.perform(get("/api/profile/mcp/tokens").header("Authorization", "Bearer jwt"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].prefix").value("mj_abcde"))
                .andExpect(jsonPath("$[0].rawToken").doesNotExist())
                .andExpect(jsonPath("$[0].tokenHash").doesNotExist());
    }

    @Test
    void revokeToken_delegatesAndReturns204() throws Exception {
        mvc.perform(delete("/api/profile/mcp/tokens/42")
                        .header("Authorization", "Bearer jwt")
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isNoContent());
        verify(tokenService).revokeToken(7, 42L);
    }

    @Test
    void activity_returnsLast50() throws Exception {
        User u = new User(); u.setId(7);
        when(userRepo.findById(eq(7))).thenReturn(java.util.Optional.of(u));
        when(logRepo.findRecentByUser(eq(u), any())).thenReturn(List.of());

        mvc.perform(get("/api/profile/mcp/activity").header("Authorization", "Bearer jwt"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
```

- [ ] **Step 2: Run the test and verify failure (controller class missing)**

Run: `./mvnw -q test -Dtest=McpTokenControllerTest`
Expected: COMPILATION ERROR — `McpTokenController` not found.

### Task 2.3: McpTokenController — implementation

**Files:**
- Create: `src/main/java/com/myjourney/controller/McpTokenController.java`

- [ ] **Step 1: Create the controller**

```java
package com.myjourney.controller;

import com.myjourney.dto.mcp.CreateMcpTokenRequest;
import com.myjourney.dto.mcp.McpAccessLogResponse;
import com.myjourney.dto.mcp.McpTokenCreatedResponse;
import com.myjourney.dto.mcp.McpTokenResponse;
import com.myjourney.exception.AppException;
import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.McpTokenService;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/profile/mcp")
@CrossOrigin
public class McpTokenController {

    private static final int ACTIVITY_PAGE_SIZE = 50;

    @Autowired private McpTokenService tokenService;
    @Autowired private McpAccessLogRepository logRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private JwtUtil jwtUtil;

    @PostMapping("/tokens")
    public ResponseEntity<McpTokenCreatedResponse> create(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody CreateMcpTokenRequest req) {
        Integer userId = requireUser(auth);
        int days = req.expiryDays() == null ? 30 : req.expiryDays();
        McpTokenService.CreatedToken created = tokenService.createToken(userId, req.name(), days);
        return ResponseEntity.ok(new McpTokenCreatedResponse(
                McpTokenResponse.from(created.token()), created.rawToken()));
    }

    @GetMapping("/tokens")
    public ResponseEntity<List<McpTokenResponse>> list(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        Integer userId = requireUser(auth);
        return ResponseEntity.ok(tokenService.listTokens(userId).stream()
                .map(McpTokenResponse::from).toList());
    }

    @DeleteMapping("/tokens/{id}")
    public ResponseEntity<Void> revoke(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable Long id) {
        Integer userId = requireUser(auth);
        tokenService.revokeToken(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/activity")
    public ResponseEntity<List<McpAccessLogResponse>> activity(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        Integer userId = requireUser(auth);
        var user = userRepo.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
        var rows = logRepo.findRecentByUser(user, PageRequest.of(0, ACTIVITY_PAGE_SIZE));
        return ResponseEntity.ok(rows.stream().map(McpAccessLogResponse::from).toList());
    }

    private Integer requireUser(String authHeader) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) throw new AppException(HttpStatus.UNAUTHORIZED, "Auth required");
        return userId;
    }
}
```

- [ ] **Step 2: Run the test and verify it passes**

Run: `./mvnw -q test -Dtest=McpTokenControllerTest`
Expected: 4 tests passed.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/controller/McpTokenController.java \
        src/test/java/com/myjourney/controller/McpTokenControllerTest.java
git commit -m "Add /api/profile/mcp token + activity endpoints"
```

### Task 2.4: Wire `/api/profile/mcp/**` into SecurityConfig

**Files:**
- Modify: `src/main/java/com/myjourney/config/SecurityConfig.java`

- [ ] **Step 1: Add the authenticated rule alongside `/api/profile/**`**

The existing line `.requestMatchers("/api/profile/**").authenticated()` already covers the new path because the new endpoints live under that prefix. **No change needed**. Verify by:

Run: `grep '/api/profile' src/main/java/com/myjourney/config/SecurityConfig.java`
Expected: the existing line `.requestMatchers("/api/profile/**").authenticated()` is present.

- [ ] **Step 2: Confirm by running the controller test against the full app context**

Run: `./mvnw -q test -Dtest=MyJourneyApplicationTests,McpTokenControllerTest`
Expected: both pass.

- [ ] **Step 3: No commit needed (no file change).**

---

## Phase 3 — MCP Authentication Filter

### Task 3.1: McpAuthenticationFilter — write the failing test

**Files:**
- Create: `src/test/java/com/myjourney/filter/McpAuthenticationFilterTest.java`

- [ ] **Step 1: Create the test**

```java
package com.myjourney.filter;

import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.service.McpTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class McpAuthenticationFilterTest {

    @AfterEach
    void clearCtx() { SecurityContextHolder.clearContext(); }

    @Test
    void validToken_setsSecurityContextAndContinues() throws Exception {
        McpTokenService svc = mock(McpTokenService.class);
        User u = new User(); u.setId(7);
        McpApiToken t = new McpApiToken(); t.setId(42L); t.setUser(u);
        when(svc.verifyToken("mj_good")).thenReturn(Optional.of(t));

        McpAuthenticationFilter filter = new McpAuthenticationFilter(svc);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.addHeader("Authorization", "Bearer mj_good");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal())
                .isEqualTo("7");
        assertThat(req.getAttribute(McpAuthenticationFilter.ATTR_TOKEN_ID)).isEqualTo(42L);
        assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
    }

    @Test
    void missingHeader_returns401() throws Exception {
        McpTokenService svc = mock(McpTokenService.class);
        McpAuthenticationFilter filter = new McpAuthenticationFilter(svc);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        verifyNoInteractions(chain);
    }

    @Test
    void expiredOrUnknownToken_returns401() throws Exception {
        McpTokenService svc = mock(McpTokenService.class);
        when(svc.verifyToken(any())).thenReturn(Optional.empty());
        McpAuthenticationFilter filter = new McpAuthenticationFilter(svc);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.addHeader("Authorization", "Bearer mj_expired");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        verifyNoInteractions(chain);
    }

    @Test
    void nonMcpPath_skipsAuth() throws Exception {
        McpTokenService svc = mock(McpTokenService.class);
        McpAuthenticationFilter filter = new McpAuthenticationFilter(svc);

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/spaces");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        verifyNoInteractions(svc);
    }
}
```

- [ ] **Step 2: Run and verify failure (class missing)**

Run: `./mvnw -q test -Dtest=McpAuthenticationFilterTest`
Expected: COMPILATION ERROR.

### Task 3.2: McpAuthenticationFilter — implementation

**Files:**
- Create: `src/main/java/com/myjourney/filter/McpAuthenticationFilter.java`

- [ ] **Step 1: Create the filter**

```java
package com.myjourney.filter;

import com.myjourney.model.McpApiToken;
import com.myjourney.service.McpTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Optional;

// Authenticates requests to /mcp using long-lived API tokens (mj_<...>).
// Mirrors JwtAuthenticationFilter in shape but lives on a separate path so
// the JWT filter doesn't have to know about token formats. On success,
// populates SecurityContext with the user id (matches the convention the
// rest of the app already uses) and stashes the token id on the request as
// an attribute so the McpToolBridge can use it for audit logging without a
// second DB hit.
@Component
public class McpAuthenticationFilter extends OncePerRequestFilter {

    public static final String ATTR_TOKEN_ID = "com.myjourney.mcp.tokenId";

    private final McpTokenService tokenService;

    public McpAuthenticationFilter(McpTokenService tokenService) {
        this.tokenService = tokenService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.equals("/mcp") && !path.startsWith("/mcp/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            unauthorized(response, "Missing bearer token");
            return;
        }
        String raw = header.substring(7).trim();
        Optional<McpApiToken> maybe = tokenService.verifyToken(raw);
        if (maybe.isEmpty()) {
            unauthorized(response, "Invalid or expired token");
            return;
        }
        McpApiToken token = maybe.get();
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                String.valueOf(token.getUser().getId()), null, new ArrayList<>());
        SecurityContextHolder.getContext().setAuthentication(auth);
        request.setAttribute(ATTR_TOKEN_ID, token.getId());
        chain.doFilter(request, response);
    }

    private static void unauthorized(HttpServletResponse res, String msg) throws IOException {
        res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"" + msg.replace("\"","\\\"") + "\"}");
    }
}
```

- [ ] **Step 2: Run the test and verify pass**

Run: `./mvnw -q test -Dtest=McpAuthenticationFilterTest`
Expected: 4 tests passed.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/filter/McpAuthenticationFilter.java \
        src/test/java/com/myjourney/filter/McpAuthenticationFilterTest.java
git commit -m "Add McpAuthenticationFilter for Bearer mj_ tokens"
```

### Task 3.3: Wire SecurityConfig + skip JWT on /mcp

**Files:**
- Modify: `src/main/java/com/myjourney/config/SecurityConfig.java`
- Modify: `src/main/java/com/myjourney/filter/JwtAuthenticationFilter.java`

- [ ] **Step 1: Add MCP filter ahead of JWT filter in SecurityConfig**

In `SecurityConfig.java`, add a new `@Autowired` field for the MCP filter and adjust `filterChain` to add it before the JWT filter, with `/mcp/**` permitted by Spring Security (the filter does the auth). Apply this diff:

```java
    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired
    private com.myjourney.filter.McpAuthenticationFilter mcpAuthenticationFilter;
```

And in the `authorizeHttpRequests` block, before the existing `.anyRequest().permitAll()` line, add:

```java
                .requestMatchers("/mcp", "/mcp/**").permitAll()
```

Then at the bottom of `filterChain`, replace the single `addFilterBefore` line with:

```java
            .addFilterBefore(mcpAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
```

(Order of `addFilterBefore` calls in a chain doesn't impose a strict order between the two filters; both run before UPAF. Each has its own `shouldNotFilter` guard so they don't trample each other.)

- [ ] **Step 2: Tell JwtAuthenticationFilter to skip /mcp**

In `JwtAuthenticationFilter.java`, in `shouldNotFilter`, add the `/mcp` skip alongside the others. Edit the return statement to include:

```java
               path.equals("/mcp") ||
               path.startsWith("/mcp/") ||
```

- [ ] **Step 3: Run boot test**

Run: `./mvnw -q test -Dtest=MyJourneyApplicationTests`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/myjourney/config/SecurityConfig.java \
        src/main/java/com/myjourney/filter/JwtAuthenticationFilter.java
git commit -m "Route /mcp through McpAuthenticationFilter, skip JWT filter"
```

---

## Phase 4 — MCP Tool Bridge + JSON-RPC Endpoint

### Task 4.1: McpToolBridge — write the failing test

**Files:**
- Create: `src/test/java/com/myjourney/mcp/McpToolBridgeTest.java`

- [ ] **Step 1: Create the test**

```java
package com.myjourney.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.agent.ToolDispatcher;
import com.myjourney.exception.AppException;
import com.myjourney.model.McpApiToken;
import com.myjourney.repository.McpApiTokenRepository;
import com.myjourney.service.McpTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class McpToolBridgeTest {

    private ToolDispatcher dispatcher;
    private McpTokenService tokenService;
    private McpApiTokenRepository tokenRepo;
    private McpToolBridge bridge;

    @BeforeEach
    void setup() {
        dispatcher   = mock(ToolDispatcher.class);
        tokenService = mock(McpTokenService.class);
        tokenRepo    = mock(McpApiTokenRepository.class);
        bridge       = new McpToolBridge(dispatcher, tokenService, tokenRepo, new ObjectMapper());
    }

    @Test
    void invoke_dispatchesAndLogsSuccess() throws Exception {
        McpApiToken token = new McpApiToken(); token.setId(42L);
        com.myjourney.model.User u = new com.myjourney.model.User(); u.setId(7);
        token.setUser(u);
        when(tokenRepo.findById(42L)).thenReturn(Optional.of(token));
        when(dispatcher.dispatch(eq(7), eq("list_spaces"), any(JsonNode.class)))
                .thenReturn(Map.of("ok", true));

        JsonNode args = new ObjectMapper().readTree("{}");
        McpToolBridge.Result r = bridge.invoke(42L, "list_spaces", args);

        assertThat(r.isError()).isFalse();
        assertThat(r.payloadJson()).contains("\"ok\":true");
        verify(tokenService).recordAccess(token, "list_spaces", true);
        verify(tokenService).touchLastUsed(42L);
    }

    @Test
    void invoke_logsFailureWhenDispatcherThrows() throws Exception {
        McpApiToken token = new McpApiToken(); token.setId(42L);
        com.myjourney.model.User u = new com.myjourney.model.User(); u.setId(7);
        token.setUser(u);
        when(tokenRepo.findById(42L)).thenReturn(Optional.of(token));
        when(dispatcher.dispatch(eq(7), eq("get_document"), any(JsonNode.class)))
                .thenThrow(new AppException(HttpStatus.NOT_FOUND, "doc 99 not found"));

        JsonNode args = new ObjectMapper().readTree("{\"document_id\":99}");
        McpToolBridge.Result r = bridge.invoke(42L, "get_document", args);

        assertThat(r.isError()).isTrue();
        assertThat(r.payloadJson()).contains("doc 99 not found");
        verify(tokenService).recordAccess(token, "get_document", false);
        // last_used_at is only bumped on success to avoid lighting up the
        // dashboard with rows for malformed calls
        verify(tokenService, never()).touchLastUsed(anyLong());
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `./mvnw -q test -Dtest=McpToolBridgeTest`
Expected: COMPILATION ERROR.

### Task 4.2: McpToolBridge — implementation

**Files:**
- Create: `src/main/java/com/myjourney/mcp/McpToolBridge.java`

- [ ] **Step 1: Create the bridge**

```java
package com.myjourney.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.agent.ToolDispatcher;
import com.myjourney.exception.AppException;
import com.myjourney.model.McpApiToken;
import com.myjourney.repository.McpApiTokenRepository;
import com.myjourney.service.McpTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

// Single per-call hop between the JSON-RPC controller and our existing
// ToolDispatcher. Responsibilities:
//   1. Look up the McpApiToken (we have its id from the auth filter).
//   2. Call ToolDispatcher with the raw args JsonNode (same shape the
//      internal agent already feeds it).
//   3. Capture success/failure for the audit log; bump last_used_at on success.
//   4. Serialize the dispatcher's return value to a JSON string. The
//      controller wraps that string in MCP's {content: [{type:"text",
//      text: <jsonString>}], isError} envelope.
@Component
public class McpToolBridge {

    private final ToolDispatcher dispatcher;
    private final McpTokenService tokenService;
    private final McpApiTokenRepository tokenRepo;
    private final ObjectMapper mapper;

    public McpToolBridge(ToolDispatcher dispatcher,
                         McpTokenService tokenService,
                         McpApiTokenRepository tokenRepo,
                         ObjectMapper mapper) {
        this.dispatcher   = dispatcher;
        this.tokenService = tokenService;
        this.tokenRepo    = tokenRepo;
        this.mapper       = mapper;
    }

    public record Result(String payloadJson, boolean isError) {}

    public Result invoke(Long tokenId, String toolName, JsonNode args) {
        McpApiToken token = tokenRepo.findById(tokenId)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "Token revoked"));
        Integer userId = token.getUser().getId();
        JsonNode argsNode = args == null ? mapper.createObjectNode() : args;
        try {
            Object out = dispatcher.dispatch(userId, toolName, argsNode);
            String json = mapper.writeValueAsString(out);
            tokenService.recordAccess(token, toolName, true);
            tokenService.touchLastUsed(tokenId);
            return new Result(json, false);
        } catch (Exception e) {
            tokenService.recordAccess(token, toolName, false);
            String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            String json = "{\"error\":\"" + msg.replace("\\","\\\\").replace("\"","\\\"") + "\"}";
            return new Result(json, true);
        }
    }
}
```

- [ ] **Step 2: Run the test and verify pass**

Run: `./mvnw -q test -Dtest=McpToolBridgeTest`
Expected: 2 tests passed.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/mcp/McpToolBridge.java \
        src/test/java/com/myjourney/mcp/McpToolBridgeTest.java
git commit -m "Add McpToolBridge: dispatch + audit + last-used bump"
```

### Task 4.3: McpProtocol — constants and envelope helpers

**Files:**
- Create: `src/main/java/com/myjourney/mcp/McpProtocol.java`

- [ ] **Step 1: Create the file**

```java
package com.myjourney.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

// MCP / JSON-RPC 2.0 wire format constants and tiny envelope builders.
// Pure static -- no Spring beans, no state. Keeps the controller code in
// McpJsonRpcController focused on dispatch rather than JSON shape.
//
// References:
//   - JSON-RPC 2.0 spec (jsonrpc, id, method, params / result / error)
//   - MCP spec (initialize / tools/list / tools/call shapes, error codes)
public final class McpProtocol {

    private McpProtocol() {}

    // Protocol version we advertise to clients. MCP clients (Claude Desktop,
    // Cursor) accept this and adapt; if a client sends a newer version in
    // its initialize call we still respond with ours, and the client falls
    // back to the intersection of supported features (just tools, for us).
    public static final String PROTOCOL_VERSION = "2025-03-26";

    public static final String SERVER_NAME    = "my-journey";
    public static final String SERVER_VERSION = "1.0.0";

    // -- JSON-RPC method names ---------------------------------------
    public static final String METHOD_INITIALIZE             = "initialize";
    public static final String METHOD_TOOLS_LIST             = "tools/list";
    public static final String METHOD_TOOLS_CALL             = "tools/call";
    public static final String METHOD_PING                   = "ping";
    public static final String METHOD_NOTIFICATIONS_INITED   = "notifications/initialized";

    // -- JSON-RPC 2.0 error codes ------------------------------------
    public static final int ERROR_PARSE             = -32700;
    public static final int ERROR_INVALID_REQUEST   = -32600;
    public static final int ERROR_METHOD_NOT_FOUND  = -32601;
    public static final int ERROR_INVALID_PARAMS    = -32602;
    public static final int ERROR_INTERNAL          = -32603;

    // -- Envelope builders -------------------------------------------

    public static ObjectNode success(ObjectMapper m, JsonNode id, JsonNode result) {
        ObjectNode env = m.createObjectNode();
        env.put("jsonrpc", "2.0");
        env.set("id", id == null ? m.nullNode() : id);
        env.set("result", result);
        return env;
    }

    public static ObjectNode error(ObjectMapper m, JsonNode id, int code, String message) {
        ObjectNode env = m.createObjectNode();
        env.put("jsonrpc", "2.0");
        env.set("id", id == null ? m.nullNode() : id);
        ObjectNode err = m.createObjectNode();
        err.put("code", code);
        err.put("message", message);
        env.set("error", err);
        return env;
    }

    // Body of the `initialize` response.
    public static ObjectNode initializeResult(ObjectMapper m) {
        ObjectNode result = m.createObjectNode();
        result.put("protocolVersion", PROTOCOL_VERSION);
        ObjectNode caps = m.createObjectNode();
        // Empty {} per spec -- we declare tools support and nothing else.
        caps.set("tools", m.createObjectNode());
        result.set("capabilities", caps);
        ObjectNode info = m.createObjectNode();
        info.put("name", SERVER_NAME);
        info.put("version", SERVER_VERSION);
        result.set("serverInfo", info);
        return result;
    }

    // Body of the `tools/list` response. Wraps the 9-tool array from
    // ToolSchemas.allSchemas() in a {tools: [...]} object so the wire shape
    // matches the MCP spec exactly.
    public static ObjectNode toolsListResult(ObjectMapper m, JsonNode allSchemas) {
        ObjectNode result = m.createObjectNode();
        ArrayNode arr = m.createArrayNode();
        for (JsonNode t : allSchemas) arr.add(t);
        result.set("tools", arr);
        return result;
    }

    // Body of the `tools/call` response.
    // Spec shape: {content: [{type:"text", text:"..."}], isError: bool}
    public static ObjectNode toolCallResult(ObjectMapper m, String text, boolean isError) {
        ObjectNode result = m.createObjectNode();
        ArrayNode content = m.createArrayNode();
        ObjectNode block = m.createObjectNode();
        block.put("type", "text");
        block.put("text", text);
        content.add(block);
        result.set("content", content);
        result.put("isError", isError);
        return result;
    }
}
```

- [ ] **Step 2: Compile**

Run: `./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/mcp/McpProtocol.java
git commit -m "Add McpProtocol: JSON-RPC + MCP envelope helpers"
```

### Task 4.4: McpJsonRpcController — write the failing test

**Files:**
- Create: `src/test/java/com/myjourney/controller/McpJsonRpcControllerTest.java`

- [ ] **Step 1: Create the slice test**

```java
package com.myjourney.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.filter.McpAuthenticationFilter;
import com.myjourney.mcp.McpToolBridge;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = McpJsonRpcController.class)
@AutoConfigureMockMvc(addFilters = false) // bypass security filters; the filter has its own test
class McpJsonRpcControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;
    @MockBean private McpToolBridge bridge;

    @Test
    void initialize_returnsProtocolVersionAndServerInfo() throws Exception {
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"jsonrpc":"2.0","id":1,"method":"initialize",
                             "params":{"protocolVersion":"2025-03-26"}}
                            """)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jsonrpc").value("2.0"))
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.result.protocolVersion").value("2025-03-26"))
                .andExpect(jsonPath("$.result.serverInfo.name").value("my-journey"))
                .andExpect(jsonPath("$.result.capabilities.tools").exists());
    }

    @Test
    void toolsList_returnsAllNineRegisteredTools() throws Exception {
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.tools.length()").value(9))
                .andExpect(jsonPath("$.result.tools[0].name").exists())
                .andExpect(jsonPath("$.result.tools[0].input_schema").exists());
    }

    @Test
    void toolsCall_delegatesToBridgeAndWrapsResult() throws Exception {
        when(bridge.invoke(eq(99L), eq("list_spaces"), any(JsonNode.class)))
                .thenReturn(new McpToolBridge.Result("[{\"id\":1}]", false));

        mvc.perform(post("/mcp")
                        .requestAttr(McpAuthenticationFilter.ATTR_TOKEN_ID, 99L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"jsonrpc":"2.0","id":3,"method":"tools/call",
                             "params":{"name":"list_spaces","arguments":{}}}
                            """)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.content[0].type").value("text"))
                .andExpect(jsonPath("$.result.content[0].text").value("[{\"id\":1}]"))
                .andExpect(jsonPath("$.result.isError").value(false));

        verify(bridge).invoke(eq(99L), eq("list_spaces"), any(JsonNode.class));
    }

    @Test
    void toolsCall_returnsIsErrorTrueWhenBridgeReportsError() throws Exception {
        when(bridge.invoke(eq(99L), eq("get_document"), any(JsonNode.class)))
                .thenReturn(new McpToolBridge.Result("{\"error\":\"not found\"}", true));

        mvc.perform(post("/mcp")
                        .requestAttr(McpAuthenticationFilter.ATTR_TOKEN_ID, 99L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"jsonrpc":"2.0","id":4,"method":"tools/call",
                             "params":{"name":"get_document","arguments":{"document_id":99}}}
                            """)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(true));
    }

    @Test
    void ping_returnsEmptyResult() throws Exception {
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"ping\"}")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").isMap())
                .andExpect(jsonPath("$.id").value(5));
    }

    @Test
    void notificationsInitialized_returns202WithNoBody() throws Exception {
        // Notifications have no `id` -- per JSON-RPC, server MUST NOT respond.
        // We acknowledge with 202 Accepted and an empty body.
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}")
                        .with(csrf()))
                .andExpect(status().isAccepted())
                .andExpect(content().string(""));
    }

    @Test
    void unknownMethod_returnsMethodNotFoundError() throws Exception {
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"bogus\"}")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(-32601))
                .andExpect(jsonPath("$.error.message").value(org.hamcrest.Matchers.containsString("bogus")));
    }

    @Test
    void getMcp_returns405() throws Exception {
        // Spec allows servers to skip server-initiated streaming. We do.
        mvc.perform(get("/mcp"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void malformedJson_returnsParseError() throws Exception {
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(-32700));
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `./mvnw -q test -Dtest=McpJsonRpcControllerTest`
Expected: COMPILATION ERROR — `McpJsonRpcController` not found.

### Task 4.5: McpJsonRpcController — implementation

**Files:**
- Create: `src/main/java/com/myjourney/controller/McpJsonRpcController.java`

- [ ] **Step 1: Create the controller**

```java
package com.myjourney.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.myjourney.agent.ToolSchemas;
import com.myjourney.filter.McpAuthenticationFilter;
import com.myjourney.mcp.McpProtocol;
import com.myjourney.mcp.McpToolBridge;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Hand-rolled JSON-RPC 2.0 endpoint that speaks the slice of MCP Streamable
// HTTP we actually need. POST /mcp accepts a single request envelope and
// returns a single response envelope (or 202 + empty body for notifications).
// GET /mcp returns 405 -- we don't push server-initiated messages, and the
// spec explicitly permits servers to opt out of that half of the transport.
//
// NO @CrossOrigin: spec §6.5 -- MCP is not browser-facing.
@RestController
@RequestMapping("/mcp")
public class McpJsonRpcController {

    @Autowired private McpToolBridge bridge;
    @Autowired private ObjectMapper mapper;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> handle(@RequestBody(required = false) String rawBody,
                                            HttpServletRequest request) {
        JsonNode req;
        try {
            if (rawBody == null || rawBody.isBlank()) {
                throw new JsonProcessingException("empty body"){};
            }
            req = mapper.readTree(rawBody);
        } catch (JsonProcessingException e) {
            // Parse error: no id available -- per JSON-RPC 2.0 the id is null.
            return ResponseEntity.ok(
                    McpProtocol.error(mapper, null, McpProtocol.ERROR_PARSE, "Parse error"));
        }

        JsonNode idNode = req.get("id");
        boolean isNotification = (idNode == null || idNode.isNull());

        String method = req.has("method") ? req.get("method").asText() : "";
        JsonNode params = req.has("params") ? req.get("params") : mapper.createObjectNode();

        // Notifications: process side effects (if any) and return 202 with no body.
        if (isNotification) {
            // We only honour notifications/initialized today; any other
            // notification is silently accepted.
            return ResponseEntity.accepted().build();
        }

        try {
            ObjectNode result = switch (method) {
                case McpProtocol.METHOD_INITIALIZE   -> McpProtocol.initializeResult(mapper);
                case McpProtocol.METHOD_TOOLS_LIST   -> McpProtocol.toolsListResult(mapper,
                                                            ToolSchemas.allSchemas());
                case McpProtocol.METHOD_TOOLS_CALL   -> handleToolsCall(params, request);
                case McpProtocol.METHOD_PING         -> mapper.createObjectNode();
                default -> null;
            };
            if (result == null) {
                return ResponseEntity.ok(McpProtocol.error(mapper, idNode,
                        McpProtocol.ERROR_METHOD_NOT_FOUND,
                        "Method not found: " + method));
            }
            return ResponseEntity.ok(McpProtocol.success(mapper, idNode, result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(McpProtocol.error(mapper, idNode,
                    McpProtocol.ERROR_INVALID_PARAMS, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.ok(McpProtocol.error(mapper, idNode,
                    McpProtocol.ERROR_INTERNAL,
                    "Internal error: " + (e.getMessage() == null
                            ? e.getClass().getSimpleName() : e.getMessage())));
        }
    }

    // The tools/call body is {name, arguments}. We pull the token id off the
    // request attribute that McpAuthenticationFilter set, then delegate to
    // McpToolBridge which owns the audit log + last-used bump.
    private ObjectNode handleToolsCall(JsonNode params, HttpServletRequest request) {
        if (params == null || !params.has("name")) {
            throw new IllegalArgumentException("tools/call requires `name`");
        }
        String toolName = params.get("name").asText();
        JsonNode args = params.has("arguments") ? params.get("arguments") : mapper.createObjectNode();

        Object attr = request.getAttribute(McpAuthenticationFilter.ATTR_TOKEN_ID);
        if (!(attr instanceof Long tokenId)) {
            // Should not happen -- the filter must have run before this controller.
            // Fall through to tools/call with a synthetic error result.
            return McpProtocol.toolCallResult(mapper, "{\"error\":\"unauthenticated\"}", true);
        }
        McpToolBridge.Result r = bridge.invoke(tokenId, toolName, args);
        return McpProtocol.toolCallResult(mapper, r.payloadJson(), r.isError());
    }

    @GetMapping
    public ResponseEntity<Void> noServerStream() {
        // The MCP Streamable HTTP spec allows servers to opt out of the SSE
        // half of the transport by returning 405 on GET. We do; we don't
        // push server-initiated messages.
        return ResponseEntity.status(405).build();
    }
}
```

- [ ] **Step 2: Run the controller test and verify it passes**

Run: `./mvnw -q test -Dtest=McpJsonRpcControllerTest`
Expected: 9 tests passed.

- [ ] **Step 3: Run the full backend suite to confirm no regression**

Run: `./mvnw -q test`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/myjourney/controller/McpJsonRpcController.java \
        src/test/java/com/myjourney/controller/McpJsonRpcControllerTest.java
git commit -m "Add hand-rolled MCP JSON-RPC endpoint at POST /mcp"
```

### Task 4.6: Integration smoke test — boot the server and call tools/list

**Files:**
- Create: `src/test/java/com/myjourney/mcp/McpServerIntegrationTest.java`

- [ ] **Step 1: Create the integration test**

```java
package com.myjourney.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.McpTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class McpServerIntegrationTest {

    @LocalServerPort private int port;
    @Autowired private McpTokenService tokenService;
    @Autowired private UserRepository userRepo;
    @Autowired private com.myjourney.repository.McpApiTokenRepository tokenRepo;
    @Autowired private com.myjourney.repository.McpAccessLogRepository logRepo;
    @Autowired private com.myjourney.repository.SpaceRepository spaceRepo;
    @Autowired private com.myjourney.repository.SpaceMemberRepository memberRepo;
    @Autowired private ObjectMapper mapper;

    private User createdUser;
    private McpApiToken createdToken;

    // Each test creates its own user + token in the dev DB (tests share the
    // developer's MySQL). We delete everything we created in @AfterEach so
    // repeated runs don't pollute the schema.
    @org.junit.jupiter.api.AfterEach
    void cleanup() {
        if (createdToken != null) {
            logRepo.deleteAll(logRepo.findByTokenOrderByCalledAtDesc(
                    createdToken, org.springframework.data.domain.PageRequest.of(0, 1000)).getContent());
            tokenRepo.deleteById(createdToken.getId());
        }
        if (createdUser != null) {
            // The personal space + member row are created lazily on first
            // login; the integration test never logs in so there shouldn't
            // be any. Be defensive in case future code changes that.
            memberRepo.findSpaceIdsByUser(createdUser).forEach(sid ->
                spaceRepo.findById(sid).ifPresent(s -> {
                    memberRepo.deleteAll(memberRepo.findBySpace(s));
                    spaceRepo.delete(s);
                }));
            userRepo.deleteById(createdUser.getId());
        }
    }

    @Test
    void initializeThenToolsList_returnsAllNineTools() throws Exception {
        User u = new User();
        u.setUsername("mcp-itest-" + System.nanoTime());
        u.setEmail(u.getUsername() + "@example.com");
        u.setPassword("x");
        createdUser = u = userRepo.save(u);
        McpTokenService.CreatedToken ct = tokenService.createToken(u.getId(), "itest", 30);
        createdToken = ct.token();

        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.set("Authorization", "Bearer " + ct.rawToken());

        RestTemplate rt = new RestTemplate();
        String initBody = """
                {"jsonrpc":"2.0","id":1,"method":"initialize",
                 "params":{"protocolVersion":"2025-03-26","capabilities":{},
                           "clientInfo":{"name":"itest","version":"0"}}}
                """;
        ResponseEntity<String> initRes = rt.exchange(
                "http://localhost:" + port + "/mcp",
                HttpMethod.POST, new HttpEntity<>(initBody, h), String.class);
        assertThat(initRes.getStatusCode().value()).isEqualTo(200);
        assertThat(mapper.readTree(initRes.getBody()).at("/result/protocolVersion").asText())
                .isEqualTo("2025-03-26");

        String listBody = """
                {"jsonrpc":"2.0","id":2,"method":"tools/list"}
                """;
        ResponseEntity<String> listRes = rt.exchange(
                "http://localhost:" + port + "/mcp",
                HttpMethod.POST, new HttpEntity<>(listBody, h), String.class);
        assertThat(listRes.getStatusCode().value()).isEqualTo(200);
        JsonNode tools = mapper.readTree(listRes.getBody()).at("/result/tools");
        assertThat(tools.size()).isEqualTo(9);
    }

    @Test
    void missingBearer_returns401() {
        RestTemplate rt = new RestTemplate();
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        try {
            rt.exchange("http://localhost:" + port + "/mcp",
                    HttpMethod.POST,
                    new HttpEntity<>("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}", h),
                    String.class);
            org.assertj.core.api.Assertions.fail("expected 401");
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            assertThat(e.getStatusCode().value()).isEqualTo(401);
        }
    }
}
```

- [ ] **Step 2: Run it**

Run: `./mvnw -q test -Dtest=McpServerIntegrationTest`
Expected: 2 tests passed.

- [ ] **Step 3: Commit**

```bash
git add src/test/java/com/myjourney/mcp/McpServerIntegrationTest.java
git commit -m "Add MCP server integration smoke test"
```

---

## Phase 5 — Rate Limiting + Audit Activity

### Task 5.1: Extend RateLimitFilter with MCP buckets

**Files:**
- Modify: `src/main/java/com/myjourney/filter/RateLimitFilter.java`

- [ ] **Step 1: Update `shouldNotFilter` to include /mcp**

Replace the `shouldNotFilter` method with:

```java
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.equals("/api/login")
            && !path.equals("/api/register")
            && !path.equals("/api/forgot-password")
            && !path.startsWith("/api/entries/ai-")
            && !path.equals("/api/agent/chat")
            && !path.equals("/mcp")
            && !path.startsWith("/mcp/");
    }
```

- [ ] **Step 2: Add the two MCP bucket maps as fields**

Add alongside the existing maps:

```java
    private final ConcurrentHashMap<Long,    Bucket> mcpPerTokenBuckets = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Integer, Bucket> mcpPerUserBuckets  = new ConcurrentHashMap<>();
```

- [ ] **Step 3: Inject McpTokenService for token resolution**

Replace the single `@Autowired private JwtUtil jwtUtil;` block with:

```java
    @Autowired private JwtUtil jwtUtil;
    @Autowired private com.myjourney.service.McpTokenService mcpTokenService;
```

- [ ] **Step 4: Add an MCP branch in `doFilterInternal`**

Insert a new `else if` branch right after the `/api/agent/chat` branch and before the `/api/login` branch:

```java
        } else if (path.equals("/mcp") || path.startsWith("/mcp/")) {
            // 60 req/min/token and 1000 req/day/user (spec §6.4).
            // The auth filter runs after this one, so re-resolve the token here.
            String h = request.getHeader("Authorization");
            if (h == null || !h.startsWith("Bearer ")) {
                filterChain.doFilter(request, response);
                return;
            }
            var maybe = mcpTokenService.verifyToken(h.substring(7).trim());
            if (maybe.isEmpty()) {
                filterChain.doFilter(request, response);
                return;
            }
            var token = maybe.get();
            Bucket perToken = mcpPerTokenBuckets.computeIfAbsent(
                    token.getId(), k -> newBucket(60, Duration.ofMinutes(1)));
            Bucket perUser  = mcpPerUserBuckets.computeIfAbsent(
                    token.getUser().getId(), k -> newBucket(1000, Duration.ofDays(1)));
            var perTokenProbe = perToken.tryConsumeAndReturnRemaining(1);
            var perUserProbe  = perUser.tryConsumeAndReturnRemaining(1);
            if (!perTokenProbe.isConsumed() || !perUserProbe.isConsumed()) {
                // Spec §6.4 — 429 must include Retry-After. Pick the longer of the
                // two wait times so the client backs off enough to clear both buckets.
                long waitNanos = Math.max(
                        perTokenProbe.isConsumed() ? 0 : perTokenProbe.getNanosToWaitForRefill(),
                        perUserProbe.isConsumed()  ? 0 : perUserProbe.getNanosToWaitForRefill());
                long retrySeconds = Math.max(1, waitNanos / 1_000_000_000L);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setHeader("Retry-After", String.valueOf(retrySeconds));
                response.setContentType("application/json");
                response.getWriter().write(
                        "{\"error\":\"MCP rate limit exceeded\"}");
                return;
            }
            filterChain.doFilter(request, response);
            return;
        }
```

Be careful to place this branch *before* the trailing `if (bucket.tryConsume(1))` block (which still handles the other branches). The MCP branch handles its own bucket consumption and returns early.

- [ ] **Step 5: Run the boot test + the integration test**

Run: `./mvnw -q test -Dtest=MyJourneyApplicationTests,McpServerIntegrationTest`
Expected: both pass (the integration test issues only 2 requests with the same token, well under both limits).

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/myjourney/filter/RateLimitFilter.java
git commit -m "Rate-limit /mcp at 60/min/token and 1000/day/user"
```

### Task 5.2: McpAccessLog cleanup is already wired

No change — `McpToolBridge` writes the row, and the controller surfaces it via `/api/profile/mcp/activity`. Move on to scheduled cleanup in Phase 6.

---

## Phase 6 — Scheduled Maintenance

### Task 6.1: McpMaintenanceScheduler — write the failing test

**Files:**
- Create: `src/test/java/com/myjourney/scheduler/McpMaintenanceSchedulerTest.java`

- [ ] **Step 1: Create the test**

```java
package com.myjourney.scheduler;

import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.repository.McpApiTokenRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class McpMaintenanceSchedulerTest {

    @Test
    void sweep_deletesExpiredTokensAndPurgesOldLogs() {
        McpApiTokenRepository tokens = mock(McpApiTokenRepository.class);
        McpAccessLogRepository logs  = mock(McpAccessLogRepository.class);
        when(tokens.deleteExpired(any())).thenReturn(3);
        when(logs.deleteByCalledAtBefore(any())).thenReturn(15L);

        McpMaintenanceScheduler scheduler = new McpMaintenanceScheduler(tokens, logs);

        scheduler.sweep();

        verify(tokens).deleteExpired(any(LocalDateTime.class));
        verify(logs).deleteByCalledAtBefore(any(LocalDateTime.class));
    }
}
```

- [ ] **Step 2: Run to verify failure (class missing)**

Run: `./mvnw -q test -Dtest=McpMaintenanceSchedulerTest`
Expected: COMPILATION ERROR.

### Task 6.2: McpMaintenanceScheduler — implementation

**Files:**
- Create: `src/main/java/com/myjourney/scheduler/McpMaintenanceScheduler.java`

- [ ] **Step 1: Create the scheduler**

```java
package com.myjourney.scheduler;

import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.repository.McpApiTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

// Daily maintenance for MCP infrastructure (spec §6.5):
//   - Delete tokens past their expired_at
//   - Purge access log rows older than 30 days
//
// Runs at 03:15 UTC -- low traffic, after the daily MySQL dump (02:00 UTC).
@Component
public class McpMaintenanceScheduler {

    private static final Logger log = LoggerFactory.getLogger(McpMaintenanceScheduler.class);
    private static final int LOG_RETENTION_DAYS = 30;

    private final McpApiTokenRepository tokenRepo;
    private final McpAccessLogRepository logRepo;

    public McpMaintenanceScheduler(McpApiTokenRepository tokenRepo,
                                   McpAccessLogRepository logRepo) {
        this.tokenRepo = tokenRepo;
        this.logRepo   = logRepo;
    }

    @Scheduled(cron = "0 15 3 * * *", zone = "UTC")
    @Transactional
    public void sweep() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        int tokensRemoved = tokenRepo.deleteExpired(now);
        long logsPurged   = logRepo.deleteByCalledAtBefore(now.minusDays(LOG_RETENTION_DAYS));
        log.info("MCP maintenance sweep: {} expired tokens deleted, {} log rows purged",
                tokensRemoved, logsPurged);
    }
}
```

- [ ] **Step 2: Run the test and verify pass**

Run: `./mvnw -q test -Dtest=McpMaintenanceSchedulerTest`
Expected: 1 test passed.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/myjourney/scheduler/McpMaintenanceScheduler.java \
        src/test/java/com/myjourney/scheduler/McpMaintenanceSchedulerTest.java
git commit -m "Add daily MCP maintenance sweep (token expiry + log purge)"
```

---

## Phase 7 — Frontend: Profile → MCP Access

### Task 7.1: API client wrapper

**Files:**
- Create: `frontend/src/api/mcp.ts`

- [ ] **Step 1: Create the wrapper**

```typescript
// API wrappers for the MCP token management endpoints under /api/profile/mcp.
// Mirrors the typed-fetch convention from api/client.ts.

import { apiRequest } from './client'

export interface McpToken {
  id: number
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  expiredAt: string
}

export interface McpTokenCreated {
  token: McpToken
  rawToken: string  // shown ONCE to the user, never stored
}

export interface McpAccessLogEntry {
  tokenName: string
  prefix: string
  toolName: string
  calledAt: string
  success: boolean
}

export function listMcpTokens() {
  return apiRequest<McpToken[]>('/profile/mcp/tokens')
}

export function createMcpToken(name: string, expiryDays: 30 | 90 | 365) {
  return apiRequest<McpTokenCreated>('/profile/mcp/tokens', {
    method: 'POST',
    body: JSON.stringify({ name, expiryDays }),
  })
}

export function revokeMcpToken(id: number) {
  return apiRequest<void>(`/profile/mcp/tokens/${id}`, { method: 'DELETE' })
}

export function listMcpActivity() {
  return apiRequest<McpAccessLogEntry[]>('/profile/mcp/activity')
}
```

- [ ] **Step 2: Compile**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

### Task 7.2: McpAccessPage component test — write first

**Files:**
- Create: `frontend/src/pages/profile/McpAccessPage.test.tsx`

- [ ] **Step 1: Create the test**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, vi, beforeEach, expect } from 'vitest'

import McpAccessPage from './McpAccessPage'
import * as mcpApi from '@/api/mcp'

vi.mock('@/api/mcp')

describe('McpAccessPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('renders the user’s tokens in a list', async () => {
    vi.mocked(mcpApi.listMcpTokens).mockResolvedValue([
      {
        id: 1,
        name: 'Claude Desktop',
        prefix: 'mj_abcde',
        createdAt: '2026-05-20T12:00:00Z',
        lastUsedAt: null,
        expiredAt: '2026-06-19T12:00:00Z',
      },
    ])
    vi.mocked(mcpApi.listMcpActivity).mockResolvedValue([])

    render(<MemoryRouter><McpAccessPage /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('Claude Desktop')).toBeInTheDocument()
      expect(screen.getByText(/mj_abcde/)).toBeInTheDocument()
    })
  })

  it('reveals the raw token only once after creation', async () => {
    vi.mocked(mcpApi.listMcpTokens).mockResolvedValue([])
    vi.mocked(mcpApi.listMcpActivity).mockResolvedValue([])
    vi.mocked(mcpApi.createMcpToken).mockResolvedValue({
      token: {
        id: 99,
        name: 'My Mac',
        prefix: 'mj_xyz12',
        createdAt: '2026-05-21T10:00:00Z',
        lastUsedAt: null,
        expiredAt: '2026-06-20T10:00:00Z',
      },
      rawToken: 'mj_xyz12_RAW_SECRET',
    })

    render(<MemoryRouter><McpAccessPage /></MemoryRouter>)

    await userEvent.click(await screen.findByRole('button', { name: /new token/i }))
    await userEvent.type(screen.getByLabelText(/name/i), 'My Mac')
    await userEvent.click(screen.getByRole('button', { name: /create/i }))

    expect(await screen.findByText('mj_xyz12_RAW_SECRET')).toBeInTheDocument()

    // Dismiss the reveal panel; the raw token should no longer be in the DOM
    await userEvent.click(screen.getByRole('button', { name: /i've copied it/i }))
    expect(screen.queryByText('mj_xyz12_RAW_SECRET')).not.toBeInTheDocument()
  })

  it('revokes a token when the trash button is clicked', async () => {
    vi.mocked(mcpApi.listMcpTokens)
      .mockResolvedValueOnce([
        {
          id: 7, name: 'Old', prefix: 'mj_old123',
          createdAt: '2026-05-01T00:00:00Z', lastUsedAt: null,
          expiredAt: '2026-05-31T00:00:00Z',
        },
      ])
      .mockResolvedValueOnce([])
    vi.mocked(mcpApi.listMcpActivity).mockResolvedValue([])
    vi.mocked(mcpApi.revokeMcpToken).mockResolvedValue(undefined as unknown as void)

    render(<MemoryRouter><McpAccessPage /></MemoryRouter>)

    await userEvent.click(await screen.findByRole('button', { name: /revoke/i }))
    await userEvent.click(await screen.findByRole('button', { name: /yes, revoke/i }))

    await waitFor(() => expect(mcpApi.revokeMcpToken).toHaveBeenCalledWith(7))
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && npx vitest run McpAccessPage.test.tsx`
Expected: FAIL — component file not found.

### Task 7.3: McpAccessPage component — implementation

**Files:**
- Create: `frontend/src/pages/profile/McpAccessPage.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { useEffect, useState } from 'react'
import PageTopBar from '@/components/ui/PageTopBar'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/feedback'
import {
  listMcpTokens, createMcpToken, revokeMcpToken, listMcpActivity,
  type McpToken, type McpTokenCreated, type McpAccessLogEntry,
} from '@/api/mcp'
import './Profile.css'

// Profile → MCP Access.
// Lets a user mint long-lived API tokens for external MCP clients,
// view recent tool calls, and revoke tokens. The raw token is shown
// exactly once -- after the reveal modal is dismissed the value is gone.

export default function McpAccessPage() {
  const toast = useToast()
  const [tokens, setTokens] = useState<McpToken[]>([])
  const [activity, setActivity] = useState<McpAccessLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate]   = useState(false)
  const [newName, setNewName]         = useState('')
  const [newExpiry, setNewExpiry]     = useState<30 | 90 | 365>(30)
  const [creating, setCreating]       = useState(false)
  const [reveal, setReveal]           = useState<McpTokenCreated | null>(null)
  const [confirmId, setConfirmId]     = useState<number | null>(null)
  const [revoking, setRevoking]       = useState(false)

  useEffect(() => { void refresh() }, [])

  async function refresh() {
    setLoading(true)
    try {
      const [t, a] = await Promise.all([listMcpTokens(), listMcpActivity()])
      setTokens(t); setActivity(a)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await createMcpToken(newName.trim(), newExpiry)
      setReveal(created)
      setShowCreate(false)
      setNewName('')
      setNewExpiry(30)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create token')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: number) {
    setRevoking(true)
    try {
      await revokeMcpToken(id)
      setConfirmId(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke')
    } finally {
      setRevoking(false)
    }
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success('Copied'),
      () => toast.error('Copy failed — select manually'),
    )
  }

  const claudeDesktopSnippet = JSON.stringify({
    mcpServers: {
      'my-journey': {
        url: 'https://myjourneycloud.com/mcp',
        headers: { Authorization: 'Bearer mj_<your token here>' },
      },
    },
  }, null, 2)

  return (
    <div className="prof-page">
      <PageTopBar title="MCP Access" />
      <div className="prof-inner">

        {/* ── Intro ──────────────────────────────────────── */}
        <div className="prof-section">
          <p className="prof-section-label">About</p>
          <div className="prof-rows-card" style={{ padding: '12px 16px' }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--label-secondary)' }}>
              MCP tokens let external clients like Claude Desktop and Cursor read and write
              your My Journey knowledge base. Tokens carry the same permissions as your
              account — guard them like a password.
            </p>
          </div>
        </div>

        {/* ── Tokens list ────────────────────────────────── */}
        <div className="prof-section">
          <div className="prof-section-header">
            <p className="prof-section-label">Tokens</p>
            <button
              className="prof-btn prof-btn--primary"
              onClick={() => setShowCreate(true)}
            >
              New token
            </button>
          </div>

          <div className="prof-rows-card">
            {loading ? (
              <div className="prof-row">
                <span style={{ color: 'var(--label-tertiary)' }}>Loading…</span>
              </div>
            ) : tokens.length === 0 ? (
              <div className="prof-row">
                <span style={{ color: 'var(--label-tertiary)' }}>
                  No tokens yet. Create one to connect an MCP client.
                </span>
              </div>
            ) : tokens.map(t => (
              <div className="prof-row" key={t.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: 'var(--label-primary)' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>
                    {t.prefix}… · expires {new Date(t.expiredAt).toLocaleDateString()}
                    {t.lastUsedAt
                      ? ` · last used ${new Date(t.lastUsedAt).toLocaleString()}`
                      : ' · never used'}
                  </div>
                </div>
                <button
                  className="prof-btn prof-btn--ghost"
                  onClick={() => setConfirmId(t.id)}
                  aria-label="Revoke token"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Claude Desktop config snippet ──────────────── */}
        <div className="prof-section">
          <p className="prof-section-label">Claude Desktop config</p>
          <div className="prof-rows-card" style={{ padding: '12px 16px' }}>
            <pre style={{
              margin: 0, padding: '10px 12px',
              background: 'var(--bg-secondary)', borderRadius: 8,
              fontSize: 12, overflowX: 'auto',
              color: 'var(--label-primary)',
            }}>{claudeDesktopSnippet}</pre>
            <button
              className="prof-btn prof-btn--ghost"
              style={{ marginTop: 8 }}
              onClick={() => copyToClipboard(claudeDesktopSnippet)}
            >
              <Icon name="copy" size={14} /> Copy snippet
            </button>
          </div>
        </div>

        {/* ── Recent activity ────────────────────────────── */}
        <div className="prof-section">
          <p className="prof-section-label">Recent activity</p>
          <div className="prof-rows-card">
            {activity.length === 0 ? (
              <div className="prof-row">
                <span style={{ color: 'var(--label-tertiary)' }}>No activity in the last 30 days.</span>
              </div>
            ) : activity.map((a, i) => (
              <div className="prof-row" key={i}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--label-primary)' }}>{a.toolName}</span>
                    {' · '}
                    <span style={{ color: a.success ? 'var(--green)' : 'var(--red)' }}>
                      {a.success ? 'ok' : 'error'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>
                    {a.tokenName} ({a.prefix}…) · {new Date(a.calledAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Create token modal ────────────────────────────── */}
      {showCreate && (
        <div className="prof-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="prof-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 17 }}>New API token</h3>

            <div className="prof-field">
              <label className="prof-label" htmlFor="mcp-name">Name</label>
              <input
                id="mcp-name"
                className="prof-input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Claude Desktop on MacBook"
                maxLength={100}
                autoFocus
              />
            </div>

            <div className="prof-field">
              <label className="prof-label" htmlFor="mcp-exp">Expiry</label>
              <select
                id="mcp-exp"
                className="prof-input"
                value={newExpiry}
                onChange={e => setNewExpiry(Number(e.target.value) as 30 | 90 | 365)}
              >
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
              </select>
            </div>

            <div className="prof-pw-actions">
              <button className="prof-btn prof-btn--ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="prof-btn prof-btn--primary"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reveal-once modal ─────────────────────────────── */}
      {reveal && (
        <div className="prof-modal-backdrop">
          <div className="prof-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 17 }}>Copy your new token</h3>
            <p style={{ fontSize: 13, color: 'var(--label-secondary)' }}>
              This is the only time you'll see this token. Store it in a password manager
              or your client's config before dismissing this dialog.
            </p>
            <pre style={{
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              borderRadius: 8, fontSize: 13,
              overflowX: 'auto',
              color: 'var(--label-primary)',
            }}>{reveal.rawToken}</pre>
            <div className="prof-pw-actions">
              <button
                className="prof-btn prof-btn--ghost"
                onClick={() => copyToClipboard(reveal.rawToken)}
              >
                Copy
              </button>
              <button
                className="prof-btn prof-btn--primary"
                onClick={() => setReveal(null)}
              >
                I've copied it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm revoke ────────────────────────────────── */}
      {confirmId !== null && (
        <div className="prof-modal-backdrop" onClick={() => setConfirmId(null)}>
          <div className="prof-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 17 }}>Revoke token?</h3>
            <p style={{ fontSize: 13, color: 'var(--label-secondary)' }}>
              The MCP client using this token will lose access immediately.
            </p>
            <div className="prof-pw-actions">
              <button className="prof-btn prof-btn--ghost" onClick={() => setConfirmId(null)}>
                Cancel
              </button>
              <button
                className="prof-btn prof-btn--primary"
                onClick={() => handleRevoke(confirmId!)}
                disabled={revoking}
              >
                {revoking ? 'Revoking…' : 'Yes, revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the small CSS additions used above**

Open `frontend/src/pages/profile/Profile.css`. Append:

```css
/* MCP Access page additions */
.prof-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.prof-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.prof-modal {
  background: var(--bg-elevated);
  border-radius: 14px;
  padding: 20px;
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 14px;
}
```

- [ ] **Step 3: Run the test and verify pass**

Run: `cd frontend && npx vitest run McpAccessPage.test.tsx`
Expected: 3 tests passed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/mcp.ts \
        frontend/src/pages/profile/McpAccessPage.tsx \
        frontend/src/pages/profile/McpAccessPage.test.tsx \
        frontend/src/pages/profile/Profile.css
git commit -m "Add Profile > MCP Access page (list, create, revoke, activity)"
```

### Task 7.4: Wire route + add link from ProfilePage

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/profile/ProfilePage.tsx`

- [ ] **Step 1: Register the route**

In `App.tsx`, just after the existing `import ProfilePage` line, add:

```tsx
import McpAccessPage      from '@/pages/profile/McpAccessPage'
```

And just after the existing `<Route path="/profile" ...>` line, add:

```tsx
        <Route path="/profile/mcp"   element={<McpAccessPage />} />
```

- [ ] **Step 2: Add the link row in ProfilePage**

In `ProfilePage.tsx`, locate the closing `</div>` of the "Security section" block and add a new "Integrations" section just after it (before the Sign-out button):

```tsx
        {/* ── Integrations section ────────────────────── */}
        <div className="prof-section">
          <p className="prof-section-label">Integrations</p>
          <div className="prof-rows-card">
            <div
              className="prof-row prof-row--expandable"
              onClick={() => navigate('/profile/mcp')}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') navigate('/profile/mcp') }}
            >
              <span style={{ flex: 1, fontSize: 15, color: 'var(--label-primary)' }}>
                MCP Access
              </span>
              <Icon name="chevron-right" size={16} className="prof-row-chevron" />
            </div>
          </div>
        </div>
```

- [ ] **Step 3: Verify build + render**

Run: `cd frontend && npm run build`
Expected: build succeeds.

Run: `cd frontend && npx vitest run`
Expected: all frontend tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/profile/ProfilePage.tsx
git commit -m "Link Profile > MCP Access from ProfilePage and add route"
```

### Task 7.5: Mobile responsiveness sanity check (390px)

The new page reuses the existing `prof-page` / `prof-inner` / `prof-row` shell, which is already responsive (verified on existing Profile/Account flows). The two additions to watch are the modals and the JSON snippet `<pre>`.

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && npm run dev`

- [ ] **Step 2: Open Chrome DevTools, set viewport to 390×844 (iPhone 14), visit `/profile/mcp`**

Verify (manually):
- Token rows wrap cleanly; "Revoke" button is reachable.
- Tap "New token" — modal width is `min(420px, calc(100vw - 32px))`, fits with 16px gutters on either side.
- The Claude Desktop snippet `<pre>` scrolls horizontally rather than overflowing.
- The reveal modal's raw token also scrolls horizontally.

- [ ] **Step 3: If any element overflows, narrow it with `max-width: 100%; overflow-x: auto;` and re-test.**

- [ ] **Step 4: No commit unless step 3 was needed.**

---

## Phase 8 — README MCP Setup Section

### Task 8.1: Append MCP setup docs to README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current README to find the right insertion point**

Run: `grep -n '^##' README.md`
Expected: a list of top-level sections. Identify the section right after deployment / before contributors (or wherever similar feature docs already live).

- [ ] **Step 2: Append the following section just before the final "License" or "Contributing" section (or at the end if neither exists)**

```markdown
## MCP setup

You can connect external MCP clients (Claude Desktop, Cursor) to your My Journey
knowledge base — they get access to the same 9 tools the in-app agent uses
(search, read, list, create, comment).

1. Sign in on [myjourneycloud.com](https://myjourneycloud.com).
2. Open **Profile → MCP Access** and click **New token**.
3. Copy the token shown — you only see it once.
4. Add this block to your Claude Desktop config
   (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

5. Restart Claude Desktop. You should see `search_documents`, `create_document`,
   and the other tools listed in Claude Desktop's tool inspector.

The MCP endpoint enforces 60 requests per minute per token and 1000 per day per
user. Revoke tokens any time from the same page.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document MCP setup with Claude Desktop config snippet"
```

---

## Phase 9 — Final Verification

### Task 9.1: Full backend test suite

- [ ] **Step 1: Run the full backend suite**

Run: `./mvnw -q test`
Expected: BUILD SUCCESS — all existing + new tests pass.

### Task 9.2: Full frontend test suite

- [ ] **Step 1: Run vitest**

Run: `cd frontend && npx vitest run`
Expected: every test passes.

### Task 9.3: Manual end-to-end smoke

- [ ] **Step 1: Start backend**

Run: `./mvnw -q spring-boot:run`

- [ ] **Step 2: Start frontend dev server in a second terminal**

Run: `cd frontend && npm run dev`

- [ ] **Step 3: Through the browser:**
  1. Log in. Visit `/profile/mcp`. Create a token, copy it.
  2. From a separate shell, run an `initialize` + `tools/list` JSON-RPC POST against `http://localhost:8080/mcp` with `Authorization: Bearer mj_<copied>`. Expect 9 tools.
  3. Call `tools/call` with `list_spaces`. Expect a result with at least the user's personal space.
  4. Back in the browser, refresh `/profile/mcp` → verify `last_used_at` is set and the two calls show up under Recent activity.
  5. Revoke the token. The next JSON-RPC call should return 401.

### Task 9.4: Update roadmap

- [ ] **Step 1: Mark sub-project 5 as done in `docs/roadmap.md`** (find the team-KB pivot phasing block; flip MCP from pending to done).

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "Mark MCP server sub-project as complete in roadmap"
```

---

## Out of Scope (matches spec §10)

- File upload via MCP — read-only attachments through `getDocument` URLs only.
- `deleteDocument` / `deleteComment` over MCP — destructive ops stay UI-only.
- Per-client capability negotiation beyond what `initialize` returns (tools only — no resources, prompts, sampling, or logging capabilities).
- A separate "service account" abstraction — every token still maps 1:1 to a user.

## Open Questions Left for Execution Time

- Whether any of the off-the-shelf MCP clients (Claude Desktop, Cursor) require an `Mcp-Session-Id` response header from `initialize`. Today we don't issue one — the spec says servers MAY include it and clients MUST echo it if present, so absence is conformant. If real-world testing in Phase 9 shows a client rejects sessionless servers, add a UUID `Mcp-Session-Id` header on `initialize` responses and ignore (rather than validate) it on subsequent requests. This is a 5-line change in `McpJsonRpcController`.
- Whether to expose batch JSON-RPC (array body). JSON-RPC 2.0 allows it; MCP clients we care about don't use it. Skip until needed.
