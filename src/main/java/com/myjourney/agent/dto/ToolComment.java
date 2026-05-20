package com.myjourney.agent.dto;

import java.time.LocalDateTime;

public record ToolComment(
        Long id,
        String content,
        String authorUsername,
        LocalDateTime createdAt
) {}
