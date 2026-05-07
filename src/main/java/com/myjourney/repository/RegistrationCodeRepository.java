package com.myjourney.repository;

import com.myjourney.model.RegistrationCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RegistrationCodeRepository extends JpaRepository<RegistrationCode, Integer> {
    Optional<RegistrationCode> findByEmail(String email);
    Optional<RegistrationCode> findByEmailAndCode(String email, String code);
    void deleteByEmail(String email);
}
