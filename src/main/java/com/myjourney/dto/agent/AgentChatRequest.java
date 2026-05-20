package com.myjourney.dto.agent;

import java.util.List;

// Inbound payload for POST /api/agent/chat. conversationId=null starts a new
// conversation; attachmentUrls are Cloudinary URLs the user already uploaded.
public record AgentChatRequest(
        Integer spaceId,
        Long conversationId,
        String message,
        List<String> attachmentUrls
) {}
