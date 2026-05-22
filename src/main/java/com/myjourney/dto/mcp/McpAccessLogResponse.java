package com.myjourney.dto.mcp;

import com.myjourney.model.McpAccessLog;

import java.time.LocalDateTime;

public record McpAccessLogResponse(
        String tokenName,
        String prefix,
        String toolName,
        LocalDateTime calledAt,
        boolean success) {

    public static McpAccessLogResponse from(McpAccessLog log) {
        return new McpAccessLogResponse(
                log.getToken().getName(),
                log.getToken().getPrefix(),
                log.getToolName(),
                log.getCalledAt(),
                log.isSuccess());
    }
}
