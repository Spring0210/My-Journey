package com.myjourney.repository;

import com.myjourney.model.AgentConversation;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentConversationRepository extends JpaRepository<AgentConversation, Long> {

    Page<AgentConversation> findByUserAndSpaceOrderByUpdatedAtDesc(
            User user, Space space, Pageable pageable);

    long countByUserAndSpace(User user, Space space);
}
