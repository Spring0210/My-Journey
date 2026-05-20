package com.myjourney.repository;

import com.myjourney.model.McpAccessLog;
import com.myjourney.model.McpApiToken;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface McpAccessLogRepository extends JpaRepository<McpAccessLog, Long> {

    Page<McpAccessLog> findByTokenOrderByCalledAtDesc(McpApiToken token, Pageable pageable);

    // Cleanup hook (used by the 30-day retention scheduled job in a later batch).
    long deleteByCalledAtBefore(LocalDateTime cutoff);
}
