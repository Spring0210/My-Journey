package com.myjourney.dto;

/** One item in the "my spaces" list — includes the current user's role. */
public record SpaceSummaryResponse(
        Integer id,
        String name,
        String description,
        String coverImage,
        String inviteCode,
        String role,
        String ownerUsername
) {}
