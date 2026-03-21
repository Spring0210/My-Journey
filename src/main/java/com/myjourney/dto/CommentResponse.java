package com.myjourney.dto;

import java.time.LocalDateTime;

/** A single comment on a space post. */
public record CommentResponse(
        Integer id,
        String content,
        Integer authorId,
        String authorUsername,
        String authorAvatar,
        LocalDateTime createdAt
) {}
