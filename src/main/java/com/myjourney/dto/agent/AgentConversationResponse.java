package com.myjourney.dto.agent;

import java.time.LocalDateTime;

public record AgentConversationResponse(
        Long id,
        Integer spaceId,
        String title,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
