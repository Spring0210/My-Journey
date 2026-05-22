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
