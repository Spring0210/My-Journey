package com.myjourney.repository;

import com.myjourney.model.McpAccessLog;
import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface McpAccessLogRepository extends JpaRepository<McpAccessLog, Long> {

    Page<McpAccessLog> findByTokenOrderByCalledAtDesc(McpApiToken token, Pageable pageable);

    // Recent activity panel: 50 most recent calls across all of the user's tokens.
    @Query("select l from McpAccessLog l where l.token.user = :user order by l.calledAt desc")
    List<McpAccessLog> findRecentByUser(@Param("user") User user, Pageable pageable);

    // 30-day retention purge.
    long deleteByCalledAtBefore(LocalDateTime cutoff);
}
