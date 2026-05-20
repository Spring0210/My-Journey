package com.myjourney.repository;

import com.myjourney.model.AgentConversation;
import com.myjourney.model.AgentMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AgentMessageRepository extends JpaRepository<AgentMessage, Long> {

    List<AgentMessage> findByConversationOrderByCreatedAtAsc(AgentConversation conversation);
}
