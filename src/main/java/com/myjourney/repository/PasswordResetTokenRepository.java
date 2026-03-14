package com.myjourney.repository;

import com.myjourney.model.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Integer> {
    Optional<PasswordResetToken> findByUsernameAndCode(String username, String code);
    void deleteByUsername(String username);
}
