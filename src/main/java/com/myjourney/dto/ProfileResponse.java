package com.myjourney.dto;

/** Returned after a successful profile update (username / avatar). */
public record ProfileResponse(
        String username,
        String avatar
) {}
