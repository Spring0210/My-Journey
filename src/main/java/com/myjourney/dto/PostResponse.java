package com.myjourney.dto;

import java.time.LocalDateTime;
import java.util.List;

/** A single space post with author info and reaction summary. */
public record PostResponse(
        Integer id,
        String content,
        List<String> images,
        Integer authorId,
        String authorUsername,
        String authorAvatar,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        ReactionSummary reactions
) {}
