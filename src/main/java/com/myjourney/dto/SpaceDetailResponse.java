package com.myjourney.dto;

import java.util.List;

/** Full space detail including member list. */
public record SpaceDetailResponse(
        Integer id,
        String name,
        String description,
        String coverImage,
        String inviteCode,
        String ownerUsername,
        // True for the auto-created per-user Personal Space (cannot be renamed/invited to).
        // Frontend uses this to default new-document type to JOURNAL on personal spaces.
        boolean isPersonal,
        List<MemberInfo> members
) {}
