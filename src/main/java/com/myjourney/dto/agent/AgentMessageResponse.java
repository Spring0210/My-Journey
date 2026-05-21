package com.myjourney.dto.agent;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;

// Outbound shape for a single persisted turn. content's shape varies by role:
//   USER:      [{type:'text',text}] (plus optional image/document blocks)
//   ASSISTANT: [{type:'text',text} | {type:'tool_use', ...}]
//   TOOL:      [{type:'tool_result', tool_use_id, content, is_error}]
public record AgentMessageResponse(
        Long id,
        String role,
        JsonNode content,
        LocalDateTime createdAt
) {}
