package com.myjourney.repository;

import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface McpApiTokenRepository extends JpaRepository<McpApiToken, Long> {

    // Token authentication: look up by SHA-256 hash of the bearer token.
    Optional<McpApiToken> findByTokenHash(String tokenHash);

    List<McpApiToken> findByUserOrderByCreatedAtDesc(User user);
}
