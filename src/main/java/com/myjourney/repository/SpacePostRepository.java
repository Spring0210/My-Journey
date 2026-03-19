package com.myjourney.repository;

import com.myjourney.model.Space;
import com.myjourney.model.SpacePost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpacePostRepository extends JpaRepository<SpacePost, Integer> {
    Page<SpacePost> findBySpaceOrderByCreatedAtDesc(Space space, Pageable pageable);
}
