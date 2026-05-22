package com.myjourney.scheduler;

import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.repository.McpApiTokenRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class McpMaintenanceSchedulerTest {

    @Test
    void sweep_deletesExpiredTokensAndPurgesOldLogs() {
        McpApiTokenRepository tokens = mock(McpApiTokenRepository.class);
        McpAccessLogRepository logs  = mock(McpAccessLogRepository.class);
        when(tokens.deleteExpired(any())).thenReturn(3);
        when(logs.deleteByCalledAtBefore(any())).thenReturn(15L);

        McpMaintenanceScheduler scheduler = new McpMaintenanceScheduler(tokens, logs);

        scheduler.sweep();

        verify(tokens).deleteExpired(any(LocalDateTime.class));
        verify(logs).deleteByCalledAtBefore(any(LocalDateTime.class));
    }
}
