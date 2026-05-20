package com.myjourney.repository;

import com.myjourney.model.Space;
import com.myjourney.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SpaceRepository extends JpaRepository<Space, Integer> {
    Optional<Space> findByInviteCode(String inviteCode);
    List<Space> findByOwner(User owner);
    Optional<Space> findFirstByOwnerAndPersonalTrue(User owner);
}
