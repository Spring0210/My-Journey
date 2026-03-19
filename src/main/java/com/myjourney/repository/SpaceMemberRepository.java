package com.myjourney.repository;

import com.myjourney.model.Space;
import com.myjourney.model.SpaceMember;
import com.myjourney.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SpaceMemberRepository extends JpaRepository<SpaceMember, Integer> {
    List<SpaceMember> findByUser(User user);
    List<SpaceMember> findBySpace(Space space);
    Optional<SpaceMember> findBySpaceAndUser(Space space, User user);
    boolean existsBySpaceAndUser(Space space, User user);
}
