package com.myjourney.repository;

import com.myjourney.model.SpacePost;
import com.myjourney.model.SpacePostReaction;
import com.myjourney.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SpacePostReactionRepository extends JpaRepository<SpacePostReaction, Integer> {

    Optional<SpacePostReaction> findByPostAndUser(SpacePost post, User user);

    List<SpacePostReaction> findByPost(SpacePost post);

    // Count reactions grouped by emoji for a given post
    @Query("SELECT r.emoji, COUNT(r) FROM SpacePostReaction r WHERE r.post = :post GROUP BY r.emoji")
    List<Object[]> countByPostGroupByEmoji(@Param("post") SpacePost post);

    void deleteByPost(SpacePost post);
}
