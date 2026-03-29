package com.myjourney.dto;

/** Returned on successful login. */
public record AuthResponse(
        String token,
        String refreshToken,
        String username,
        Integer userId,
        String avatar
) {}
