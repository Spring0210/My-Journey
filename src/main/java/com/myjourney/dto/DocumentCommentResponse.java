package com.myjourney.dto;

import java.time.LocalDateTime;

// A single comment on a Document. Any space member can post.
public record DocumentCommentResponse(
        Long id,
        String content,
        Integer authorId,
        String authorUsername,
        String authorAvatar,
        LocalDateTime createdAt
) {}
