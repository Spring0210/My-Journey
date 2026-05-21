package com.myjourney.repository;

import com.myjourney.model.Space;
import com.myjourney.model.SpaceMember;
import com.myjourney.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SpaceMemberRepository extends JpaRepository<SpaceMember, Integer> {
    List<SpaceMember> findByUser(User user);
    List<SpaceMember> findBySpace(Space space);
    Optional<SpaceMember> findBySpaceAndUser(Space space, User user);
    boolean existsBySpaceAndUser(Space space, User user);
    long countBySpace(Space space);

    // IDs of every space the given user is a member of. Used by the agent
    // toolset's cross-space search to scope queries to accessible spaces.
    @Query("SELECT m.space.id FROM SpaceMember m WHERE m.user = :user")
    List<Integer> findSpaceIdsByUser(@Param("user") User user);
}
