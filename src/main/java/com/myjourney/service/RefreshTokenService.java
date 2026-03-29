package com.myjourney.service;

import com.myjourney.exception.AppException;
import com.myjourney.model.RefreshToken;
import com.myjourney.repository.RefreshTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class RefreshTokenService {

    // Refresh tokens are valid for 30 days
    private static final int REFRESH_TOKEN_DAYS = 30;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    /** Create a new refresh token for the given user, replacing any existing ones. */
    @Transactional
    public RefreshToken createRefreshToken(Integer userId) {
        // One active refresh token per user — delete old ones first
        refreshTokenRepository.deleteByUserId(userId);

        RefreshToken rt = new RefreshToken();
        rt.setToken(UUID.randomUUID().toString());
        rt.setUserId(userId);
        rt.setExpiredAt(LocalDateTime.now().plusDays(REFRESH_TOKEN_DAYS));
        return refreshTokenRepository.save(rt);
    }

    /**
     * Validate the token string and return it.
     * Throws 401 AppException if not found or expired.
     */
    public RefreshToken verifyToken(String tokenValue) {
        RefreshToken rt = refreshTokenRepository.findByToken(tokenValue)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "Invalid refresh token"));

        if (rt.getExpiredAt().isBefore(LocalDateTime.now())) {
            refreshTokenRepository.delete(rt);
            throw new AppException(HttpStatus.UNAUTHORIZED, "Refresh token has expired");
        }

        return rt;
    }

    /** Rotate: delete current token and issue a new one. */
    @Transactional
    public RefreshToken rotateToken(RefreshToken old) {
        refreshTokenRepository.delete(old);
        return createRefreshToken(old.getUserId());
    }

    /** Delete all tokens for a user (explicit logout). */
    @Transactional
    public void deleteByUserId(Integer userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }
}
