package com.myjourney.dto;

/** Returned when creating, joining, or updating a space. */
public record SpaceResponse(
        Integer id,
        String name,
        String description,
        String inviteCode,
        String coverImage
) {}
