package com.myjourney.dto;

import java.time.LocalDateTime;

/** Member entry nested inside SpaceDetailResponse. */
public record MemberInfo(
        Integer userId,
        String username,
        String avatar,
        String role,
        LocalDateTime joinedAt
) {}
