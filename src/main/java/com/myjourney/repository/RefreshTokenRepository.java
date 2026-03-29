package com.myjourney.repository;

import com.myjourney.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByToken(String token);

    // Delete all tokens for a user (logout / token rotation cleanup)
    void deleteByUserId(Integer userId);
}
