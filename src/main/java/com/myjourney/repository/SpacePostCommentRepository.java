package com.myjourney.repository;

import com.myjourney.model.SpacePost;
import com.myjourney.model.SpacePostComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SpacePostCommentRepository extends JpaRepository<SpacePostComment, Integer> {

    // Get all comments for a post, oldest first
    List<SpacePostComment> findByPostOrderByCreatedAtAsc(SpacePost post);

    // Used when deleting a post to remove its comments
    void deleteByPost(SpacePost post);
}
