package com.myjourney.dto;

/** Returned on successful login. */
public record AuthResponse(
        String token,
        String username,
        Integer userId,
        String avatar
) {}
