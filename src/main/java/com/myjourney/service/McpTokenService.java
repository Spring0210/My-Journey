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
import java.util.HexFormat;
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
        // Return 404 (not 403) when the token exists but belongs to someone
        // else -- otherwise an attacker can enumerate other users' token ids
        // by watching for the 403 vs 404 distinction.
        McpApiToken t = tokenRepo.findById(tokenId)
                .filter(x -> x.getUser().getId().equals(userId))
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Token not found"));
        tokenRepo.delete(t);
    }

    public Optional<McpApiToken> verifyToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();
        String trimmed = rawToken.trim();
        if (!trimmed.startsWith(TOKEN_PREFIX)) return Optional.empty();
        Optional<McpApiToken> hit = tokenRepo.findByTokenHash(sha256Hex(trimmed));
        return hit.filter(t -> t.getExpiredAt() != null
                && t.getExpiredAt().isAfter(LocalDateTime.now(ZoneOffset.UTC)));
    }

    // Issued async from McpToolBridge after every successful tool call. Kept
    // as a separate @Transactional method so it can run on a different thread
    // without dragging the calling tx along. NOTE: Spring's AOP proxy only
    // intercepts cross-bean calls -- do not self-invoke from inside this
    // class or the @Async/@Transactional advice will silently no-op.
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
            return HexFormat.of().formatHex(md.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
