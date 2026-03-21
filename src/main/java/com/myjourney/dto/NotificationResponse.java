package com.myjourney.dto;

import java.time.LocalDateTime;

/** A single notification entry for the frontend. */
public record NotificationResponse(
        Integer id,
        String type,          // "NEW_POST" or "NEW_COMMENT"
        String actorUsername,
        String actorAvatar,   // actor's avatar URL, may be null
        Integer spaceId,
        String spaceName,
        Integer postId,
        boolean read,
        LocalDateTime createdAt
) {}
