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
        List<MemberInfo> members
) {}
