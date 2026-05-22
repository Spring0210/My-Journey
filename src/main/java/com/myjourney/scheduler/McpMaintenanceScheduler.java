package com.myjourney.scheduler;

import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.repository.McpApiTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

// Daily maintenance for MCP infrastructure:
//   - Delete tokens past their expired_at
//   - Purge access log rows older than 30 days
//
// Runs at 03:15 UTC — low traffic, after the daily MySQL dump (02:00 UTC).
@Component
public class McpMaintenanceScheduler {

    private static final Logger log = LoggerFactory.getLogger(McpMaintenanceScheduler.class);
    private static final int LOG_RETENTION_DAYS = 30;

    private final McpApiTokenRepository tokenRepo;
    private final McpAccessLogRepository logRepo;

    public McpMaintenanceScheduler(McpApiTokenRepository tokenRepo,
                                   McpAccessLogRepository logRepo) {
        this.tokenRepo = tokenRepo;
        this.logRepo   = logRepo;
    }

    @Scheduled(cron = "0 15 3 * * *", zone = "UTC")
    @Transactional
    public void sweep() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        int tokensRemoved = tokenRepo.deleteExpired(now);
        long logsPurged   = logRepo.deleteByCalledAtBefore(now.minusDays(LOG_RETENTION_DAYS));
        log.info("MCP maintenance sweep: {} expired tokens deleted, {} log rows purged",
                tokensRemoved, logsPurged);
    }
}
