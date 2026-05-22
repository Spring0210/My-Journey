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
